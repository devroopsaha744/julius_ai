import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { InterviewOrchestrator, InterviewStage } from '../lib/services/orchestrator';
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
  orchestrator: InterviewOrchestrator;
  transcribeClient: TranscribeStreamingClient;
  currentTranscript: string;
  isTranscribing: boolean;
  silenceTimer?: NodeJS.Timeout;
  audioQueue: Uint8Array[];
  transcribeStream?: any;
  resumeFilePath?: string; // Store resume file path for the session
}

class InterviewWebSocketServer {
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
        orchestrator: new InterviewOrchestrator(sessionId),
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
        case 'code_input':
          await this.handleCodeInput(ws, session, message.text, message.code);
          break;
        case 'set_resume_path':
          session.resumeFilePath = message.path;
          ws.send(JSON.stringify({ type: 'resume_path_set', path: message.path }));
          break;
      }
    } catch {
      ws.send(JSON.stringify({ type: 'error', message: 'Invalid message' }));
    }
  }

  private queueAudioChunk(session: ClientSession, buffer: Buffer) {
    if (!session.isTranscribing) return;
    console.log(`📢 Audio chunk received: ${buffer.length} bytes`);
    session.audioQueue.push(new Uint8Array(buffer));
  }

  private async startTranscription(ws: WebSocket, session: ClientSession) {
    if (session.isTranscribing) return;
    console.log('🎤 Starting transcription...');
    session.isTranscribing = true;
    session.currentTranscript = '';
    session.audioQueue = [];

    try {
      const audioStream = this.createAudioStream(session);

      const command = new StartStreamTranscriptionCommand({
        LanguageCode: "en-US",
        MediaSampleRateHertz: SAMPLE_RATE,
        MediaEncoding: "pcm",
        AudioStream: audioStream,
      });

      console.log('📡 Sending transcription command to AWS...');
      const response = await session.transcribeClient.send(command);
      session.transcribeStream = response;

      if (response.TranscriptResultStream) {
        console.log('✅ Transcription stream established');
        this.processTranscripts(ws, session, response.TranscriptResultStream);
      }

      ws.send(JSON.stringify({ type: 'transcription_started' }));
    } catch (error) {
      console.error('❌ Error starting transcription:', error);
      ws.send(JSON.stringify({ type: 'error', message: 'Failed to start transcription' }));
    }
  }

  private async *createAudioStream(session: ClientSession): AsyncIterable<AudioStream> {
    console.log('🎧 Audio stream generator started');
    while (session.isTranscribing) {
      if (session.audioQueue.length > 0) {
        const chunk = session.audioQueue.shift()!;
        console.log(`🎵 Sending audio chunk to AWS: ${chunk.length} bytes`);
        yield { AudioEvent: { AudioChunk: chunk } };
      } else {
        // Wait for more audio data
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
    console.log('🔇 Audio stream generator stopped');
  }

  private async processTranscripts(ws: WebSocket, session: ClientSession, stream: any) {
    console.log('🎧 Processing transcription stream...');
    try {
      for await (const event of stream) {
        if (!event.TranscriptEvent) continue;
        for (const result of event.TranscriptEvent.Transcript?.Results ?? []) {
          if (!result.Alternatives?.length) continue;
          const transcript = result.Alternatives[0].Transcript || '';
          if (!transcript.trim()) continue;

          console.log(`📝 Transcript: "${transcript}" (IsPartial: ${result.IsPartial})`);

          // Send partial transcripts for real-time display
          if (result.IsPartial) {
            ws.send(JSON.stringify({ type: 'partial_transcript', transcript, isPartial: true }));
          } else {
            // Accumulate final transcripts
            session.currentTranscript += transcript + ' ';
            ws.send(JSON.stringify({ type: 'partial_transcript', transcript: session.currentTranscript.trim(), isPartial: false }));
          }

          // Reset silence timer on any speech
          if (session.silenceTimer) clearTimeout(session.silenceTimer);
          session.silenceTimer = setTimeout(() => this.processSilence(ws, session), SILENCE_TIMEOUT);
        }
      }
    } catch (error) {
      console.error('❌ Error processing transcripts:', error);
    }
  }

  private async processSilence(ws: WebSocket, session: ClientSession) {
    if (!session.currentTranscript.trim()) return;

    const text = session.currentTranscript.trim();
    console.log(`🔇 Silence detected. Processing transcript: "${text}"`);
    
    ws.send(JSON.stringify({ type: 'final_transcript', transcript: text }));

    session.currentTranscript = '';
    await this.sendToAgent(ws, session, text);
  }

  private async handleTextInput(ws: WebSocket, session: ClientSession, text: string) {
    ws.send(JSON.stringify({ type: 'final_transcript', transcript: text }));
    await this.sendToAgent(ws, session, text);
  }

  private async handleCodeInput(ws: WebSocket, session: ClientSession, text: string, code?: string) {
    ws.send(JSON.stringify({ type: 'final_transcript', transcript: text }));
    await this.sendToAgent(ws, session, text, code);
  }

  private async sendToAgent(ws: WebSocket, session: ClientSession, text: string, userCode?: string) {
    ws.send(JSON.stringify({ type: 'processing' }));
    
    try {
      // Get current stage info
      const currentStage = session.orchestrator.getCurrentStage();
      ws.send(JSON.stringify({ 
        type: 'stage_info', 
        currentStage, 
        stageChanged: false 
      }));

      // Process message through orchestrator
      const result = await session.orchestrator.processMessage(
        text, 
        session.resumeFilePath, 
        userCode // Pass user code for coding rounds
      );
      
      // Send stage change notification if stage changed
      if (result.stageChanged) {
        ws.send(JSON.stringify({ 
          type: 'stage_changed', 
          previousStage: currentStage,
          newStage: result.currentStage,
          stageChanged: true
        }));
      }

      // Send agent response
      ws.send(JSON.stringify({ 
        type: 'agent_response', 
        response: result.response,
        currentStage: result.currentStage
      }));

      // Send scoring and recommendation results if available
      if (result.scoringResult) {
        ws.send(JSON.stringify({ 
          type: 'scoring_result', 
          scoring: result.scoringResult 
        }));
      }

      if (result.recommendationResult) {
        ws.send(JSON.stringify({ 
          type: 'recommendation_result', 
          recommendation: result.recommendationResult 
        }));
      }

      // Generate audio response
      await this.generateAudio(ws, result.response.assistant_message);
      
    } catch (error) {
      console.error('Error processing message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred' 
      }));
    }
  }

  private async generateAudio(ws: WebSocket, text: string) {
    ws.send(JSON.stringify({ type: 'generating_audio' }));
    const buffer = await textToSpeechBuffer(text);
    ws.send(JSON.stringify({ type: 'audio_response', audio: buffer.toString("base64"), text }));
  }

  private async stopTranscription(ws: WebSocket, session: ClientSession) {
    console.log('🔇 Stopping transcription...');
    session.isTranscribing = false;
    if (session.silenceTimer) {
      clearTimeout(session.silenceTimer);
      session.silenceTimer = undefined;
    }
    if (session.transcribeStream) {
      try {
        session.transcribeStream.destroy?.();
      } catch (error) {
        console.error('Error destroying transcribe stream:', error);
      }
      session.transcribeStream = undefined;
    }
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
export default new InterviewWebSocketServer(PORT);
