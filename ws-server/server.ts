import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { GreetingAgent } from '../lib/services/greet';
import { textToSpeechBuffer } from '../lib/utils/awsPolly';
import dotenv from 'dotenv';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream,
} from "@aws-sdk/client-transcribe-streaming";

dotenv.config({ path: '.env.local' });

const SILENCE_TIMEOUT = 3000;
const SAMPLE_RATE = 16000;

interface ClientSession {
  sessionId: string;
  greetingAgent: GreetingAgent;
  transcribeClient: TranscribeStreamingClient;
  currentTranscript: string;
  isTranscribing: boolean;
  silenceTimer?: NodeJS.Timeout;
  audioQueue: Uint8Array[];
  transcribeStream?: any;
}

class GreetingWebSocketServer {
  private wss: WebSocketServer;
  private clients: Map<WebSocket, ClientSession> = new Map();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.setupServer();
  }

  private setupServer() {
    console.log('🚀 WebSocket server starting...');

    this.wss.on('connection', (ws: WebSocket) => {
      const sessionId = uuidv4();
      const transcribeClient = new TranscribeStreamingClient({
        region: "us-west-2",
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
        },
      });

      const session: ClientSession = {
        sessionId,
        greetingAgent: new GreetingAgent(sessionId),
        transcribeClient,
        currentTranscript: '',
        isTranscribing: false,
        audioQueue: []
      };

      this.clients.set(ws, session);

      ws.send(JSON.stringify({ type: 'connected', sessionId }));

      ws.on('message', async (data: Buffer) => this.handleMessage(ws, data));
      ws.on('close', () => this.handleDisconnect(ws));
      ws.on('error', () => this.handleDisconnect(ws));
    });

    this.wss.on('listening', () => {
      console.log(`🎯 WebSocket server listening on port ${this.wss.options.port}`);
    });
  }

  private async handleMessage(ws: WebSocket, data: Buffer) {
    const session = this.clients.get(ws);
    if (!session) return;

    try {
      const message = JSON.parse(data.toString());
      switch (message.type) {
        case 'start_transcription':
          await this.startTranscription(ws, session);
          break;
        case 'audio_chunk':
          this.queueAudioChunk(session, Buffer.from(message.data, 'base64'));
          break;
        case 'stop_transcription':
          await this.stopTranscription(ws, session);
          break;
        case 'text_input':
          await this.handleTextInput(ws, session, message.text);
          break;
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
    }
  }

  private queueAudioChunk(session: ClientSession, buffer: Buffer) {
    if (!session.isTranscribing) return;
    session.audioQueue.push(new Uint8Array(buffer));
  }

  private async startTranscription(ws: WebSocket, session: ClientSession) {
    if (session.isTranscribing) return;
    session.isTranscribing = true;
    session.currentTranscript = '';
    session.audioQueue = [];

    const audioStream = this.createAudioStream(session);

    const command = new StartStreamTranscriptionCommand({
      LanguageCode: "en-US",
      MediaSampleRateHertz: SAMPLE_RATE,
      MediaEncoding: "pcm",
      AudioStream: audioStream,
    });

    const response = await session.transcribeClient.send(command);
    session.transcribeStream = response;

    if (response.TranscriptResultStream) {
      this.processTranscripts(ws, session, response.TranscriptResultStream);
    }

    ws.send(JSON.stringify({ type: 'transcription_started' }));
  }

  private async *createAudioStream(session: ClientSession): AsyncIterable<AudioStream> {
    while (session.isTranscribing) {
      if (session.audioQueue.length > 0) {
        const chunk = session.audioQueue.shift()!;
        yield { AudioEvent: { AudioChunk: chunk } };
      } else await new Promise(res => setTimeout(res, 10));
    }
  }

  private async processTranscripts(ws: WebSocket, session: ClientSession, stream: any) {
    for await (const event of stream) {
      if (!event.TranscriptEvent) continue;
      for (const result of event.TranscriptEvent.Transcript?.Results ?? []) {
        if (!result.Alternatives?.length) continue;
        const transcript = result.Alternatives[0].Transcript || '';
        if (!transcript.trim()) continue;

        // Only for frontend display
        if (result.IsPartial) {
          ws.send(JSON.stringify({ type: 'partial_transcript', transcript, isPartial: true }));
        } else {
          session.currentTranscript += transcript + ' ';
          ws.send(JSON.stringify({ type: 'partial_transcript', transcript: session.currentTranscript.trim(), isPartial: false }));
        }

        // Reset silence timer
        if (session.silenceTimer) clearTimeout(session.silenceTimer);
        session.silenceTimer = setTimeout(() => this.processSilence(ws, session), SILENCE_TIMEOUT);
      }
    }
  }

  private async processSilence(ws: WebSocket, session: ClientSession) {
    if (!session.currentTranscript.trim()) return;

    const text = session.currentTranscript.trim();
    ws.send(JSON.stringify({ type: 'final_transcript', transcript: text }));

    session.currentTranscript = '';
    await this.sendToAgent(ws, session, text);
  }

  private async handleTextInput(ws: WebSocket, session: ClientSession, text: string) {
    ws.send(JSON.stringify({ type: 'final_transcript', transcript: text }));
    await this.sendToAgent(ws, session, text);
  }

  private async sendToAgent(ws: WebSocket, session: ClientSession, text: string) {
    ws.send(JSON.stringify({ type: 'processing' }));
    const response = await session.greetingAgent.run(text);
    ws.send(JSON.stringify({ type: 'agent_response', response }));
    await this.generateAudio(ws, response.assistant_message);
  }

  private async generateAudio(ws: WebSocket, text: string) {
    ws.send(JSON.stringify({ type: 'generating_audio' }));
    const buffer = await textToSpeechBuffer(text);
    ws.send(JSON.stringify({ type: 'audio_response', audio: buffer.toString("base64"), text }));
  }

  private async stopTranscription(ws: WebSocket, session: ClientSession) {
    session.isTranscribing = false;
    if (session.silenceTimer) clearTimeout(session.silenceTimer);
    if (session.transcribeStream) session.transcribeStream.destroy?.();
    ws.send(JSON.stringify({ type: 'transcription_stopped' }));
  }

  private handleDisconnect(ws: WebSocket) {
    const session = this.clients.get(ws);
    if (!session) return;
    if (session.silenceTimer) clearTimeout(session.silenceTimer);
    session.isTranscribing = false;
    if (session.transcribeStream) session.transcribeStream.destroy?.();
    this.clients.delete(ws);
  }
}

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 8080;
export default new GreetingWebSocketServer(PORT);
