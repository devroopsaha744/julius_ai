import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { GreetingAgent } from '../lib/services/greet';
import { AWSTranscribeStreaming } from '../lib/utils/awsTranscribe';
import { textToSpeech } from '../lib/utils/awsPolly';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream,
} from "@aws-sdk/client-transcribe-streaming";

dotenv.config({ path: '.env.local' });

const SILENCE_TIMEOUT = 3000; // 3 seconds of silence before processing
const SAMPLE_RATE = 16000;

interface ClientSession {
  sessionId: string;
  greetingAgent: GreetingAgent;
  transcribeClient: TranscribeStreamingClient;
  currentTranscript: string;
  isTranscribing: boolean;
  silenceTimer?: NodeJS.Timeout;
  lastSpeechTime: number;
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
        lastSpeechTime: Date.now(),
        audioQueue: []
      };

      this.clients.set(ws, session);
      console.log(`✅ New client connected: ${sessionId}`);

      // Send initial connection message
      ws.send(JSON.stringify({
        type: 'connected',
        sessionId,
        message: 'Connected to greeting server'
      }));

      ws.on('message', async (data: Buffer) => {
        await this.handleMessage(ws, data);
      });

      ws.on('close', () => {
        this.handleDisconnect(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.handleDisconnect(ws);
      });
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
          await this.startRealTimeTranscription(ws, session);
          break;
        
        case 'audio_chunk':
          await this.processRealAudioChunk(ws, session, Buffer.from(message.data, 'base64'));
          break;
        
        case 'stop_transcription':
          await this.stopTranscription(ws, session);
          break;

        case 'text_input':
          await this.processTextInput(ws, session, message.text);
          break;
      }
    } catch (error) {
      console.error('Error handling message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing message'
      }));
    }
  }

  private async startRealTimeTranscription(ws: WebSocket, session: ClientSession) {
    if (session.isTranscribing) return;

    session.isTranscribing = true;
    session.currentTranscript = '';
    session.lastSpeechTime = Date.now();
    session.audioQueue = [];

    try {
      // Create audio stream generator
      const audioStream = this.createAudioStreamFromQueue(session);

      // Start AWS Transcribe Streaming
      const command = new StartStreamTranscriptionCommand({
        LanguageCode: "en-US",
        MediaSampleRateHertz: SAMPLE_RATE,
        MediaEncoding: "pcm",
        AudioStream: audioStream,
      });

      const response = await session.transcribeClient.send(command);
      session.transcribeStream = response;

      // Process transcription results
      if (response.TranscriptResultStream) {
        this.processTranscriptStream(ws, session, response.TranscriptResultStream);
      }

      ws.send(JSON.stringify({
        type: 'transcription_started',
        message: 'Real-time transcription started'
      }));

      console.log(`🎤 Started real-time transcription for session: ${session.sessionId}`);
    } catch (error) {
      console.error('Error starting transcription:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Failed to start transcription'
      }));
    }
  }

  private async *createAudioStreamFromQueue(session: ClientSession): AsyncIterable<AudioStream> {
    while (session.isTranscribing) {
      if (session.audioQueue.length > 0) {
        const audioChunk = session.audioQueue.shift()!;
        yield { AudioEvent: { AudioChunk: audioChunk } };
      } else {
        // Wait a bit before checking again
        await new Promise(resolve => setTimeout(resolve, 10));
      }
    }
  }

  private async processTranscriptStream(ws: WebSocket, session: ClientSession, transcriptStream: any) {
    try {
      for await (const event of transcriptStream) {
        if (event.TranscriptEvent) {
          for (const result of event.TranscriptEvent.Transcript?.Results ?? []) {
            if (result.Alternatives && result.Alternatives.length > 0) {
              const transcript = result.Alternatives[0].Transcript || '';
              
              if (transcript.trim()) {
                session.lastSpeechTime = Date.now();
                
                // Clear existing silence timer
                if (session.silenceTimer) {
                  clearTimeout(session.silenceTimer);
                }

                if (result.IsPartial) {
                  // Partial transcript - just update display
                  ws.send(JSON.stringify({
                    type: 'partial_transcript',
                    transcript: transcript,
                    isPartial: true
                  }));
                } else {
                  // Final transcript - add to current transcript
                  session.currentTranscript += transcript + ' ';
                  
                  ws.send(JSON.stringify({
                    type: 'partial_transcript',
                    transcript: session.currentTranscript.trim(),
                    isPartial: false
                  }));
                }

                // Set new silence timer
                session.silenceTimer = setTimeout(async () => {
                  await this.processSilence(ws, session);
                }, SILENCE_TIMEOUT);
              }
            }
          }
        }
      }
    } catch (error) {
      console.error('Error processing transcript stream:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Transcription stream error'
      }));
    }
  }

  private async processRealAudioChunk(ws: WebSocket, session: ClientSession, audioBuffer: Buffer) {
    if (!session.isTranscribing) return;

    try {
      // Convert audio buffer to proper format for AWS Transcribe
      // Assuming the audio is already in the correct PCM format
      const audioChunk = new Uint8Array(audioBuffer);
      
      // Add to queue for the audio stream
      session.audioQueue.push(audioChunk);
      
    } catch (error) {
      console.error('Error processing real audio chunk:', error);
    }
  }

  private async processSilence(ws: WebSocket, session: ClientSession) {
    if (!session.currentTranscript.trim()) return;

    console.log(`🔇 Silence detected for session: ${session.sessionId}`);
    
    // Send final transcript
    ws.send(JSON.stringify({
      type: 'final_transcript',
      transcript: session.currentTranscript.trim()
    }));

    // Process through GreetingAgent
    await this.processWithAgent(ws, session, session.currentTranscript.trim());

    // Reset transcript but keep transcription running
    session.currentTranscript = '';
  }

  private async processTextInput(ws: WebSocket, session: ClientSession, text: string) {
    console.log(`💬 Text input for session: ${session.sessionId} - "${text}"`);
    
    ws.send(JSON.stringify({
      type: 'final_transcript',
      transcript: text
    }));

    await this.processWithAgent(ws, session, text);
  }

  private async processWithAgent(ws: WebSocket, session: ClientSession, text: string) {
    try {
      ws.send(JSON.stringify({
        type: 'processing',
        message: 'Processing with AI...'
      }));

      // Get response from GreetingAgent
      const agentResponse = await session.greetingAgent.run(text);
      
      console.log(`🤖 Agent response for session: ${session.sessionId}`, agentResponse);

      // Send text response
      ws.send(JSON.stringify({
        type: 'agent_response',
        response: agentResponse
      }));

      // Generate and send audio from assistant_message
      await this.generateAndSendAudio(ws, session, agentResponse.assistant_message);

    } catch (error) {
      console.error('Error processing with agent:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error processing with AI agent'
      }));
    }
  }

  private async generateAndSendAudio(ws: WebSocket, session: ClientSession, text: string) {
    try {
      ws.send(JSON.stringify({
        type: 'generating_audio',
        message: 'Generating speech...'
      }));

      // Generate unique filename for this audio
      const audioFileName = `temp_audio_${session.sessionId}_${Date.now()}.mp3`;
      const audioFilePath = path.join(process.cwd(), 'temp', audioFileName);

      // Ensure temp directory exists
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Use AWS Polly to generate speech
      await textToSpeech(text, audioFilePath);

      // Read the generated file and convert to base64
      const audioBuffer = fs.readFileSync(audioFilePath);
      const base64Audio = audioBuffer.toString('base64');

      ws.send(JSON.stringify({
        type: 'audio_response',
        audio: base64Audio,
        text: text
      }));

      // Clean up temporary file
      fs.unlinkSync(audioFilePath);

      console.log(`🔊 Audio generated and sent for session: ${session.sessionId}`);
    } catch (error) {
      console.error('Error generating audio:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: 'Error generating audio response'
      }));
    }
  }

  private async stopTranscription(ws: WebSocket, session: ClientSession) {
    session.isTranscribing = false;
    
    if (session.silenceTimer) {
      clearTimeout(session.silenceTimer);
    }

    // Clean up transcribe stream if exists
    if (session.transcribeStream) {
      try {
        session.transcribeStream.destroy();
      } catch (error) {
        console.error('Error closing transcribe stream:', error);
      }
    }

    ws.send(JSON.stringify({
      type: 'transcription_stopped',
      message: 'Stopped listening'
    }));

    console.log(`⏹️ Stopped transcription for session: ${session.sessionId}`);
  }

  private handleDisconnect(ws: WebSocket) {
    const session = this.clients.get(ws);
    if (session) {
      // Clean up timers
      if (session.silenceTimer) {
        clearTimeout(session.silenceTimer);
      }
      
      // Stop transcription
      session.isTranscribing = false;
      
      // Clean up transcribe stream
      if (session.transcribeStream) {
        try {
          session.transcribeStream.destroy();
        } catch (error) {
          console.error('Error closing transcribe stream on disconnect:', error);
        }
      }
      
      console.log(`👋 Client disconnected: ${session.sessionId}`);
      this.clients.delete(ws);
    }
  }
}

// Start the server
const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 8080;
const server = new GreetingWebSocketServer(PORT);

export default server;