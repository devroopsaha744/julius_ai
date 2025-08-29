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
const SPEECH_SILENCE_THRESHOLD = 2000; // 2 seconds
const CODE_IDLE_THRESHOLD = 5000; // 5 seconds
const KEYSTROKE_DEBOUNCE = 300; // 300ms

interface CodingStreamState {
  lastKeystroke: number;
  codeContent: string;
  hasNewCode: boolean;
  isTyping: boolean;
  keystrokeTimer?: NodeJS.Timeout;
}

interface SpeechStreamState {
  lastSpeech: number;
  speechContent: string;
  hasNewSpeech: boolean;
  isSpeaking: boolean;
  silenceTimer?: NodeJS.Timeout;
}

interface InvocationState {
  lastInvocation: number;
  pendingInvocation: boolean;
  audioPlaybackActive: boolean;
  invocationTimer?: NodeJS.Timeout;
}

interface ClientSession {
  sessionId: string;
  orchestrator: InterviewOrchestrator;
  transcribeClient: TranscribeStreamingClient;
  currentTranscript: string;
  isTranscribing: boolean;
  silenceTimer?: NodeJS.Timeout;
  audioQueue: Uint8Array[];
  transcribeStream?: any;
  resumeFilePath?: string;
  
  // Enhanced coding stage tracking
  codingState: CodingStreamState;
  speechState: SpeechStreamState;
  invocationState: InvocationState;
  isInCodingStage: boolean;
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

  private queueAudioChunk(session: ClientSession, buffer: Buffer) {
    if (!session.isTranscribing) return;
    
    // Block audio input during LLM invocation or audio playback to prevent interruptions
    if (session.invocationState.pendingInvocation || session.invocationState.audioPlaybackActive) {
      const reason = session.invocationState.pendingInvocation ? 'LLM invocation in progress' : 'AI audio playback active';
      console.log(`🚫 Audio blocked: ${reason}`);
      return;
    }
    
    console.log(`📢 Audio chunk received: ${buffer.length} bytes`);
    session.audioQueue.push(new Uint8Array(buffer));
  }

  private async startTranscription(ws: WebSocket, session: ClientSession) {
    if (session.isTranscribing) return;
    
    // Block transcription start during LLM invocation or audio playback
    if (session.invocationState.pendingInvocation || session.invocationState.audioPlaybackActive) {
      const reason = session.invocationState.pendingInvocation ? 'Julius is thinking' : 'Julius is speaking';
      console.log(`🚫 Transcription blocked: ${reason}`);
      ws.send(JSON.stringify({ 
        type: 'transcription_blocked', 
        message: `Please wait for Julius to finish ${session.invocationState.pendingInvocation ? 'responding' : 'speaking'} before speaking` 
      }));
      return;
    }
    
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
      ws.send(JSON.stringify({ type: 'server_error', message: 'Failed to start transcription' }));
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
    
    // For coding stage, update speech state and check dual-stream invocation
    if (session.isInCodingStage) {
      this.updateSpeechState(session, text, true);
      session.currentTranscript = '';
      await this.checkDualStreamInvocation(ws, session);
    } else {
      // Normal behavior for non-coding stages
      ws.send(JSON.stringify({ type: 'final_transcript', transcript: text }));
      session.currentTranscript = '';
      await this.sendToAgent(ws, session, text);
    }
  }

  private async handleTextInput(ws: WebSocket, session: ClientSession, text: string) {
    ws.send(JSON.stringify({ type: 'final_transcript', transcript: text }));
    await this.sendToAgent(ws, session, text);
  }

  private async handleCodeInput(ws: WebSocket, session: ClientSession, text: string, code?: string, language?: string, explanation?: string) {
    // For coding stage, update coding state and check for dual-stream invocation
    if (session.isInCodingStage) {
      this.updateCodingState(session, code || '', true);
      this.updateSpeechState(session, text, true);
      await this.checkDualStreamInvocation(ws, session, text, code, language, explanation);
    } else {
      // Normal behavior for non-coding stages
      const fullMessage = language && explanation 
        ? `Language: ${language}\nExplanation: ${explanation}\n\nCode:\n${code || 'No code provided'}\n\nUser Message: ${text}`
        : text;
      
      ws.send(JSON.stringify({ type: 'final_transcript', transcript: fullMessage }));
      await this.sendToAgent(ws, session, fullMessage, code);
    }
  }

  private async handleCodeKeystroke(ws: WebSocket, session: ClientSession, code: string, language?: string) {
    if (!session.isInCodingStage) return;
    
    console.log(`⌨️ Code keystroke tracked - Length: ${code.length}, Language: ${language}`);
    this.updateCodingState(session, code, false);
    
    // Check if we should invoke based on dual-stream state
    await this.checkDualStreamInvocation(ws, session);
  }

  private handleStageChange(session: ClientSession, stage: string) {
    const wasInCodingStage = session.isInCodingStage;
    session.isInCodingStage = stage === 'coding';
    
    if (session.isInCodingStage && !wasInCodingStage) {
      console.log(`🔄 Entering coding stage - Dual-stream tracking enabled`);
      this.resetDualStreamState(session);
    } else if (!session.isInCodingStage && wasInCodingStage) {
      console.log(`🔄 Exiting coding stage - Dual-stream tracking disabled`);
      this.cleanupDualStreamTimers(session);
    }
  }

  private updateCodingState(session: ClientSession, code: string, isFinalSubmission: boolean = false) {
    const now = Date.now();
    const hasNewContent = code !== session.codingState.codeContent;
    
    if (hasNewContent || isFinalSubmission) {
      session.codingState.codeContent = code;
      session.codingState.lastKeystroke = now;
      session.codingState.hasNewCode = true;
      session.codingState.isTyping = !isFinalSubmission;
      
      // Clear existing keystroke timer
      if (session.codingState.keystrokeTimer) {
        clearTimeout(session.codingState.keystrokeTimer);
      }
      
      // Set timer to detect when coding stops (unless it's a final submission)
      if (!isFinalSubmission) {
        session.codingState.keystrokeTimer = setTimeout(() => {
          session.codingState.isTyping = false;
          console.log(`⌨️ Code typing stopped`);
        }, KEYSTROKE_DEBOUNCE);
      }
      
      console.log(`⌨️ Code state updated - Length: ${code.length}, IsTyping: ${session.codingState.isTyping}`);
    }
  }

  private updateSpeechState(session: ClientSession, speech: string, isFinalTranscript: boolean = false) {
    const now = Date.now();
    const hasNewContent = speech !== session.speechState.speechContent;
    
    if (hasNewContent || isFinalTranscript) {
      session.speechState.speechContent = speech;
      session.speechState.lastSpeech = now;
      session.speechState.hasNewSpeech = true;
      session.speechState.isSpeaking = !isFinalTranscript;
      
      // Clear existing silence timer
      if (session.speechState.silenceTimer) {
        clearTimeout(session.speechState.silenceTimer);
      }
      
      // Set timer to detect when speech stops (unless it's a final transcript)
      if (!isFinalTranscript) {
        session.speechState.silenceTimer = setTimeout(() => {
          session.speechState.isSpeaking = false;
          console.log(`🗣️ Speech stopped`);
        }, SPEECH_SILENCE_THRESHOLD);
      }
      
      console.log(`🗣️ Speech state updated - Length: ${speech.length}, IsSpeaking: ${session.speechState.isSpeaking}`);
    }
  }

  private async checkDualStreamInvocation(ws: WebSocket, session: ClientSession, text?: string, code?: string, language?: string, explanation?: string) {
    if (!session.isInCodingStage || session.invocationState.pendingInvocation) {
      return;
    }
    
    const now = Date.now();
    const timeSinceLastInvocation = now - session.invocationState.lastInvocation;
    
    // Minimum time between invocations to prevent spam
    if (timeSinceLastInvocation < 1000) {
      return;
    }
    
    const speechIdle = !session.speechState.isSpeaking && (now - session.speechState.lastSpeech) > SPEECH_SILENCE_THRESHOLD;
    const codeIdle = !session.codingState.isTyping && (now - session.codingState.lastKeystroke) > CODE_IDLE_THRESHOLD;
    
    const hasNewSpeech = session.speechState.hasNewSpeech;
    const hasNewCode = session.codingState.hasNewCode;
    const hasNewContent = hasNewSpeech || hasNewCode;
    
    console.log(`🔍 Dual-stream check:`, {
      speechIdle,
      codeIdle,
      hasNewSpeech,
      hasNewCode,
      hasNewContent,
      speechLen: session.speechState.speechContent.length,
      codeLen: session.codingState.codeContent.length
    });
    
    // Determine if we should invoke based on the rules
    let shouldInvoke = false;
    let reason = '';
    
    if (text && code) {
      // Direct submission - invoke immediately
      shouldInvoke = true;
      reason = 'Direct code submission';
    } else if (speechIdle && codeIdle && hasNewContent) {
      // Both streams are idle and we have new content
      shouldInvoke = true;
      reason = 'Both streams idle with new content';
    } else if (speechIdle && hasNewSpeech && session.codingState.codeContent.length === 0) {
      // Only speech, no code typed yet
      shouldInvoke = true;
      reason = 'Speech only (no code)';
    } else if (codeIdle && hasNewCode && session.speechState.speechContent.length === 0) {
      // Only code, no speech yet
      shouldInvoke = true;
      reason = 'Code only (no speech)';
    }
    
    if (shouldInvoke) {
      console.log(`🚀 Invoking LLM - Reason: ${reason}`);
      session.invocationState.pendingInvocation = true;
      session.invocationState.lastInvocation = now;
      
      // Notify client that LLM processing has started
      ws.send(JSON.stringify({ type: 'llm_processing_started' }));
      
      // Create comprehensive message
      const fullMessage = this.createComprehensiveMessage(session, text, code, language, explanation);
      
      // Reset new content flags
      session.speechState.hasNewSpeech = false;
      session.codingState.hasNewCode = false;
      
      // Send to agent
      ws.send(JSON.stringify({ type: 'final_transcript', transcript: fullMessage }));
      await this.sendToAgent(ws, session, fullMessage, session.codingState.codeContent);
      
      session.invocationState.pendingInvocation = false;
      
      // Notify client that LLM processing has finished
      ws.send(JSON.stringify({ type: 'llm_processing_finished' }));
    } else {
      // Schedule a delayed check if one stream is still active
      if (!session.invocationState.invocationTimer) {
        session.invocationState.invocationTimer = setTimeout(() => {
          session.invocationState.invocationTimer = undefined;
          this.checkDualStreamInvocation(ws, session);
        }, Math.min(SPEECH_SILENCE_THRESHOLD, CODE_IDLE_THRESHOLD));
      }
    }
  }

  private createComprehensiveMessage(session: ClientSession, text?: string, code?: string, language?: string, explanation?: string): string {
    let message = '';
    
    // Add current speech content
    if (session.speechState.speechContent.trim()) {
      message += `Speech: ${session.speechState.speechContent.trim()}\n\n`;
    }
    
    // Add any additional text input
    if (text && text.trim() && text !== session.speechState.speechContent) {
      message += `Additional Input: ${text.trim()}\n\n`;
    }
    
    // Add code content
    if (session.codingState.codeContent.trim() || code) {
      const codeContent = code || session.codingState.codeContent;
      message += `Code (${language || 'unknown'}):\n\`\`\`${language || ''}\n${codeContent}\n\`\`\`\n\n`;
    }
    
    // Add explanation if provided
    if (explanation && explanation.trim()) {
      message += `Explanation: ${explanation.trim()}\n\n`;
    }
    
    return message.trim() || 'No content provided';
  }

  private resetDualStreamState(session: ClientSession) {
    // Reset coding state
    session.codingState.codeContent = '';
    session.codingState.hasNewCode = false;
    session.codingState.isTyping = false;
    session.codingState.lastKeystroke = 0;
    
    // Reset speech state
    session.speechState.speechContent = '';
    session.speechState.hasNewSpeech = false;
    session.speechState.isSpeaking = false;
    session.speechState.lastSpeech = 0;
    
    // Reset invocation state
    session.invocationState.lastInvocation = 0;
    session.invocationState.pendingInvocation = false;
    session.invocationState.audioPlaybackActive = false;
    
    this.cleanupDualStreamTimers(session);
  }

  private cleanupDualStreamTimers(session: ClientSession) {
    if (session.codingState.keystrokeTimer) {
      clearTimeout(session.codingState.keystrokeTimer);
      session.codingState.keystrokeTimer = undefined;
    }
    
    if (session.speechState.silenceTimer) {
      clearTimeout(session.speechState.silenceTimer);
      session.speechState.silenceTimer = undefined;
    }
    
    if (session.invocationState.invocationTimer) {
      clearTimeout(session.invocationState.invocationTimer);
      session.invocationState.invocationTimer = undefined;
    }
  }

  private async sendToAgent(ws: WebSocket, session: ClientSession, text: string, userCode?: string) {
    console.log(`🤖 Sending to agent - Stage: ${session.orchestrator.getCurrentStage()}, Text: "${text}"`);
    
    // Set pending invocation flag to block audio input during processing
    session.invocationState.pendingInvocation = true;
    ws.send(JSON.stringify({ type: 'processing' }));
    
    try {
      // Get current stage info
      const currentStage = session.orchestrator.getCurrentStage();
      console.log(`📋 Current stage before processing: ${currentStage}`);
      
      ws.send(JSON.stringify({ 
        type: 'stage_info', 
        currentStage, 
        stageChanged: false 
      }));

      // Process message through orchestrator
      console.log(`🔄 Processing message through orchestrator...`);
      const result = await session.orchestrator.processMessage(
        text, 
        session.resumeFilePath, 
        userCode // Pass user code for coding rounds
      );
      
      console.log(`✅ Orchestrator result:`, {
        stageChanged: result.stageChanged,
        currentStage: result.currentStage,
        responseLength: result.response?.assistant_message?.length || 0
      });
      
      // Send stage change notification if stage changed
      if (result.stageChanged) {
        console.log(`🔄 Stage changed from ${currentStage} to ${result.currentStage}`);
        ws.send(JSON.stringify({ 
          type: 'stage_changed', 
          previousStage: currentStage,
          newStage: result.currentStage,
          stageChanged: true
        }));
      }

      // Send agent response
      console.log(`💬 Sending agent response for stage: ${result.currentStage}`);
      ws.send(JSON.stringify({ 
        type: 'agent_response', 
        response: result.response,
        currentStage: result.currentStage
      }));

      // Send scoring and recommendation results if available
      if (result.scoringResult) {
        console.log(`📊 Sending scoring result`);
        ws.send(JSON.stringify({ 
          type: 'scoring_result', 
          scoring: result.scoringResult 
        }));
      }

      if (result.recommendationResult) {
        console.log(`💡 Sending recommendation result`);
        ws.send(JSON.stringify({ 
          type: 'recommendation_result', 
          recommendation: result.recommendationResult 
        }));
      }

      // Generate audio response
      console.log(`🔊 Generating audio for response...`);
      await this.generateAudio(ws, session, result.response.assistant_message);
      
      // Clear pending invocation flag but keep audio playback active
      session.invocationState.pendingInvocation = false;
      ws.send(JSON.stringify({ type: 'processing_finished' }));
      console.log(`✅ Successfully completed sendToAgent for stage: ${result.currentStage}, audio playback started`);
      
    } catch (error) {
      console.error('❌ Error in sendToAgent:', error);
      console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace');
      console.error('❌ Error details:', {
        sessionId: session.sessionId,
        currentStage: session.orchestrator.getCurrentStage(),
        text: text,
        hasUserCode: !!userCode
      });
      
      // Clear pending invocation flag even on error to re-enable microphone
      session.invocationState.pendingInvocation = false;
      
      ws.send(JSON.stringify({ 
        type: 'server_error', 
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        stage: session.orchestrator.getCurrentStage()
      }));
      
      // Notify client that processing is finished so microphone can be reactivated
      ws.send(JSON.stringify({ type: 'processing_finished' }));
    }
  }

  private async generateAudio(ws: WebSocket, session: ClientSession, text: string) {
    ws.send(JSON.stringify({ type: 'generating_audio' }));
    const buffer = await textToSpeechBuffer(text);
    
    // Set audio playback active state
    session.invocationState.audioPlaybackActive = true;
    ws.send(JSON.stringify({ 
      type: 'audio_response', 
      audio: buffer.toString("base64"), 
      text 
    }));
    
    // Notify client that audio playback has started
    ws.send(JSON.stringify({ type: 'audio_playback_started' }));
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

  private async handleAudioPlaybackFinished(ws: WebSocket, session: ClientSession) {
    console.log('🔇 Audio playback finished, enabling microphone...');
    session.invocationState.audioPlaybackActive = false;
    ws.send(JSON.stringify({ 
      type: 'microphone_enabled',
      message: 'You can now speak'
    }));
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
