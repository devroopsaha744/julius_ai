import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { TranscribeStreamingClient } from '@aws-sdk/client-transcribe-streaming';
import { InterviewOrchestrator } from '../lib/services/orchestrator';
import type { ClientSession } from './types';
import { DeepgramSTTService } from '../lib/utils/deepgramSTT';
import { textToSpeechBuffer } from '../lib/utils/elevenlabsTTS';
import { updateCodingState, updateSpeechState, checkDualStreamInvocation, resetDualStreamState, cleanupDualStreamTimers } from './coding';
import { sendToAgent, createComprehensiveMessage } from './agent';

dotenv.config({ path: '.env.local' });

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
  deepgramService: null,
        currentTranscript: '',
        isTranscribing: false,
        audioQueue: [],
        
        // Initialize coding stage tracking
        codingState: {
          lastKeystroke: 0,
          codeContent: '',
          hasNewCode: false,
          isTyping: false
        },
        speechState: {
          lastSpeech: 0,
          speechContent: '',
          hasNewSpeech: false,
          isSpeaking: false
        },
        invocationState: {
          lastInvocation: 0,
          pendingInvocation: false,
          audioPlaybackActive: false
        },
        isInCodingStage: false
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
          await this.startDeepgramTranscription(ws, session);
          break;
        case 'audio_chunk':
          // If deepgram is active, send directly. Otherwise queue to session.audioQueue.
          const chunk = Buffer.from(message.data, 'base64');
          if (session.deepgramService) {
            try { await session.deepgramService.sendAudio(chunk); } catch {}
          } else {
            session.audioQueue.push(new Uint8Array(chunk));
          }
          break;
        case 'stop_transcription':
          await this.stopDeepgramTranscription(ws, session);
          break;
        case 'text_input':
          await this.handleTextInput(ws, session, message.text);
          break;
        case 'code_input':
          await this.handleCodeInput(ws, session, message.text, message.code, message.language, message.explanation);
          break;
        case 'code_keystroke':
          await this.handleCodeKeystroke(ws, session, message.code, message.language);
          break;
        case 'audio_playback_finished':
          await this.handleAudioPlaybackFinished(ws, session);
          break;
        case 'stage_change':
          this.handleStageChange(session, message.stage);
          break;
        case 'set_resume_path':
          session.resumeFilePath = message.path;
          ws.send(JSON.stringify({ type: 'resume_path_set', path: message.path }));
          break;
      }
    } catch {
      ws.send(JSON.stringify({ type: 'server_error', message: 'Invalid message' }));
    }
  }

  // transcription helpers moved to ws-server/transcription.ts

  private async processSilence(ws: WebSocket, session: ClientSession) {
    if (!session.currentTranscript.trim()) return;

    const text = session.currentTranscript.trim();
    console.log(`🔇 Silence detected. Processing transcript: "${text}"`);
    
    // For coding stage, update speech state and check dual-stream invocation
    if (session.isInCodingStage) {
      updateSpeechState(session, text, true);
      session.currentTranscript = '';
      await checkDualStreamInvocation(
        ws,
        session,
        (t?: string, c?: string, l?: string, e?: string) => createComprehensiveMessage(session, t, c, l, e),
        sendToAgent
      );
    } else {
      // Normal behavior for non-coding stages
      ws.send(JSON.stringify({ type: 'final_transcript', transcript: text }));
      session.currentTranscript = '';
  const result = await sendToAgent(ws, session, text);
  if (result && result.response && result.response.assistant_message) {
    try {
      ws.send(JSON.stringify({ type: 'generating_audio' }));
      const buffer = await textToSpeechBuffer(result.response.assistant_message);
      session.invocationState.audioPlaybackActive = true;
      ws.send(JSON.stringify({ type: 'audio_response', audio: buffer.toString('base64'), text: result.response.assistant_message }));
      ws.send(JSON.stringify({ type: 'audio_playback_started' }));
    } catch (e) {
      // TTS failed — still proceed
      console.error('TTS failure', e);
    }
  }
    }
  }

  private async handleTextInput(ws: WebSocket, session: ClientSession, text: string) {
    ws.send(JSON.stringify({ type: 'final_transcript', transcript: text }));
    const result = await sendToAgent(ws, session, text);
    if (result && result.response && result.response.assistant_message) {
      try {
        ws.send(JSON.stringify({ type: 'generating_audio' }));
        const buffer = await textToSpeechBuffer(result.response.assistant_message);
        session.invocationState.audioPlaybackActive = true;
        ws.send(JSON.stringify({ type: 'audio_response', audio: buffer.toString('base64'), text: result.response.assistant_message }));
        ws.send(JSON.stringify({ type: 'audio_playback_started' }));
      } catch (e) { console.error('TTS failure', e); }
    }
  }

  private async handleCodeInput(ws: WebSocket, session: ClientSession, text: string, code?: string, language?: string, explanation?: string) {
    // For coding stage, update coding state and check for dual-stream invocation
    if (session.isInCodingStage) {
    updateCodingState(session, code || '', true);
    updateSpeechState(session, text, true);
    await checkDualStreamInvocation(
      ws,
      session,
      (t?: string, c?: string, l?: string, e?: string) => createComprehensiveMessage(session, t, c, l, e),
      sendToAgent,
      text,
      code,
      language,
      explanation
    );
    } else {
      // Normal behavior for non-coding stages
      const fullMessage = language && explanation 
        ? `Language: ${language}\nExplanation: ${explanation}\n\nCode:\n${code || 'No code provided'}\n\nUser Message: ${text}`
        : text;
      
      ws.send(JSON.stringify({ type: 'final_transcript', transcript: fullMessage }));
  const result = await sendToAgent(ws, session, fullMessage, code);
  if (result && result.response && result.response.assistant_message) {
    try {
      ws.send(JSON.stringify({ type: 'generating_audio' }));
      const buffer = await textToSpeechBuffer(result.response.assistant_message);
      session.invocationState.audioPlaybackActive = true;
      ws.send(JSON.stringify({ type: 'audio_response', audio: buffer.toString('base64'), text: result.response.assistant_message }));
      ws.send(JSON.stringify({ type: 'audio_playback_started' }));
    } catch (e) { console.error('TTS failure', e); }
  }
    }
  }

  private async handleCodeKeystroke(ws: WebSocket, session: ClientSession, code: string, language?: string) {
    if (!session.isInCodingStage) return;
    
    console.log(`⌨️ Code keystroke tracked - Length: ${code.length}, Language: ${language}`);
  updateCodingState(session, code, false);
  await checkDualStreamInvocation(
    ws,
    session,
    (t?: string, c?: string, l?: string, e?: string) => createComprehensiveMessage(session, t, c, l, e),
    sendToAgent
  );
  }

  private handleStageChange(session: ClientSession, stage: string) {
    const wasInCodingStage = session.isInCodingStage;
    session.isInCodingStage = stage === 'coding';
    
    if (session.isInCodingStage && !wasInCodingStage) {
      console.log(`🔄 Entering coding stage - Dual-stream tracking enabled`);
      resetDualStreamState(session);
    } else if (!session.isInCodingStage && wasInCodingStage) {
      console.log(`🔄 Exiting coding stage - Dual-stream tracking disabled`);
      cleanupDualStreamTimers(session);
    }
  }

  // moved: createComprehensiveMessage into ws-server/agent.ts

  // moved reset/cleanup helpers to ws-server/coding.ts

  // moved to ws-server/agent.ts

  private async handleAudioPlaybackFinished(ws: WebSocket, session: ClientSession) {
    console.log('🔇 Audio playback finished, enabling microphone...');
    session.invocationState.audioPlaybackActive = false;
    ws.send(JSON.stringify({ 
      type: 'microphone_enabled',
      message: 'You can now speak'
    }));
  }

  private async handleDisconnect(ws: WebSocket) {
    const session = this.clients.get(ws);
    if (!session) return;
    if (session.silenceTimer) clearTimeout(session.silenceTimer);
    session.isTranscribing = false;
    if (session.transcribeStream) session.transcribeStream.destroy?.();
    if (session.deepgramService) {
      try { await session.deepgramService.disconnect(); } catch {}
      session.deepgramService = null as any;
    }
    this.clients.delete(ws);
  }

  private async startDeepgramTranscription(ws: WebSocket, session: ClientSession) {
    if (session.isTranscribing) return;
    session.isTranscribing = true;
    session.currentTranscript = '';
    session.audioQueue = [];

    if (!session.deepgramService) session.deepgramService = new DeepgramSTTService();
    const dg = session.deepgramService as DeepgramSTTService;
    dg.setCallbacks(
      (transcript: string, isFinal: boolean) => {
        if (!transcript.trim()) return;
        if (isFinal) {
          session.currentTranscript += transcript + ' ';
          ws.send(JSON.stringify({ type: 'partial_transcript', transcript: session.currentTranscript.trim(), isPartial: false }));
        } else {
          ws.send(JSON.stringify({ type: 'partial_transcript', transcript, isPartial: true }));
        }
        if (session.silenceTimer) clearTimeout(session.silenceTimer);
        session.silenceTimer = setTimeout(() => this.processSilence(ws, session), parseInt(process.env.SILENCE_TIMEOUT || '1500'));
      },
      (err) => { try { ws.send(JSON.stringify({ type: 'server_error', message: `Deepgram error: ${err}` })); } catch {} },
      (utterance) => { this.processSilence(ws, session); }
    );

    const ok = await dg.connect();
    if (!ok) {
      ws.send(JSON.stringify({ type: 'server_error', message: 'Failed to connect to Deepgram' }));
      session.isTranscribing = false;
      return;
    }

    // drain queued audio in background
    (async () => {
      while (session.isTranscribing && session.deepgramService) {
        if (session.audioQueue.length > 0) {
          const chunk = session.audioQueue.shift();
          if (chunk) { try { await session.deepgramService.sendAudio(Buffer.from(chunk)); } catch {} }
        } else {
          await new Promise((r) => setTimeout(r, 10));
        }
      }
    })();

    ws.send(JSON.stringify({ type: 'transcription_started', provider: 'deepgram' }));
  }

  private async stopDeepgramTranscription(ws: WebSocket, session: ClientSession) {
    session.isTranscribing = false;
    if (session.silenceTimer) { clearTimeout(session.silenceTimer); session.silenceTimer = undefined; }
    if (session.deepgramService) {
      try { await session.deepgramService.disconnect(); } catch {}
      session.deepgramService = null as any;
    }
    ws.send(JSON.stringify({ type: 'transcription_stopped' }));
  }
}

const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 8080;
export default new InterviewWebSocketServer(PORT);
