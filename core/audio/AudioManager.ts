import { DeepgramSTTService } from '../../lib/utils/deepgramSTT';
import { textToSpeechBuffer } from '../../lib/utils/elevenlabsTTS';
import type { InterviewSession } from '../interview/InterviewSession';
import type { WebSocketResponse } from '../types/SessionTypes';
import WebSocket from 'ws';

export class AudioManager {
  private deepgramService: DeepgramSTTService | null = null;

  async startDeepgramTranscription(
    ws: WebSocket,
    session: InterviewSession,
    sendToAgent?: (ws: WebSocket, session: InterviewSession, text: string, userCode?: string) => Promise<any>,
    synthesizeAudio?: (ws: WebSocket, session: InterviewSession, text: string) => Promise<void>,
    checkCodingInvocation?: (
      ws: WebSocket,
      session: InterviewSession,
      sendToAgent: (ws: WebSocket, session: InterviewSession, text: string, userCode?: string, codeSubmitted?: boolean, options?: { minimal?: boolean }) => Promise<any>,
      text?: string,
      code?: string,
      language?: string,
      explanation?: string,
      synthesizeAudio?: (ws: WebSocket, session: InterviewSession, text: string) => Promise<void>,
      forceSpeechFinal?: boolean
    ) => Promise<void>
  ): Promise<void> {
    if (session.isTranscribing) return;
    
    session.isTranscribing = true;
    session.currentTranscript = '';
    session.audioQueue = [];

    if (!session.deepgramService) {
      session.deepgramService = new DeepgramSTTService();
    }

    const deepgram = session.deepgramService as DeepgramSTTService;
    
  deepgram.setCallbacks(
  (transcript: string, isFinal: boolean) => {
        try {
          if (!transcript.trim()) return;

          // Debug log to ensure transcripts are received and being emitted to clients
          console.log(`[AudioManager] Emitting transcript (isFinal=${isFinal}):`, transcript.trim());

          if (isFinal) {
            session.currentTranscript += transcript + ' ';
            this.sendResponse(ws, {
              type: 'partial_transcript',
              transcript: session.currentTranscript.trim(),
              isPartial: false
            });
          } else {
            this.sendResponse(ws, {
              type: 'partial_transcript',
              transcript,
              isPartial: true
            });
          }

          if (session.silenceTimer) clearTimeout(session.silenceTimer);
          session.silenceTimer = setTimeout(() => {
            this.processSilence(ws, session, sendToAgent, synthesizeAudio, checkCodingInvocation);
          }, parseInt(process.env.SILENCE_TIMEOUT || '2000'));
        } catch (e) {
          console.error('[AudioManager] Error in transcript callback:', e);
        }
      },
      (err) => {
        this.sendResponse(ws, {
          type: 'server_error',
          message: `Deepgram error: ${err}`
        });
      },
      (utterance) => {
        // Deepgram reported utterance end / speech_final — process immediately
        try {
          // Force immediate coding-stage VAD evaluation
          this.processSilence(ws, session, sendToAgent, synthesizeAudio, checkCodingInvocation);
        } catch (e) {
          console.error('[AudioManager] Error processing utterance end:', e);
        }
      }
    );

    const connected = await deepgram.connect();
    if (!connected) {
      this.sendResponse(ws, {
        type: 'server_error',
        message: 'Failed to connect to Deepgram'
      });
      session.isTranscribing = false;
      return;
    }

    // Start audio queue processing
    this.processAudioQueue(session);

    this.sendResponse(ws, {
      type: 'transcription_started',
      provider: 'deepgram'
    });
  }

  async stopDeepgramTranscription(ws: WebSocket, session: InterviewSession): Promise<void> {
    session.isTranscribing = false;
    
    if (session.silenceTimer) {
      clearTimeout(session.silenceTimer);
      session.silenceTimer = undefined;
    }
    
    if (session.deepgramService) {
      try {
        await session.deepgramService.disconnect();
      } catch (error) {
        console.error('Error disconnecting Deepgram:', error);
      }
      session.deepgramService = null as any;
    }
    
    this.sendResponse(ws, {
      type: 'transcription_stopped'
    });
  }

  async processAudioChunk(ws: WebSocket, session: InterviewSession, audioChunk: Buffer): Promise<void> {
    // If the assistant is playing audio, block STT to prevent loopback
    if (session.invocationState && session.invocationState.audioPlaybackActive) {
      // Optionally keep a small buffer or drop the chunk
      // Notify client that transcription is blocked while TTS is playing
      try {
        this.sendResponse(ws, { type: 'transcription_blocked', message: 'Assistant audio playing - transcription paused' });
      } catch (err) {
        console.error('Error notifying client about transcription block:', err);
      }
      return;
    }

    if (session.deepgramService) {
      try {
        await session.deepgramService.sendAudio(audioChunk);
      } catch (error) {
        console.error('Error sending audio to Deepgram:', error);
      }
    } else {
      session.audioQueue.push(new Uint8Array(audioChunk));
    }
  }

  async synthesizeAndSendAudio(ws: WebSocket, session: InterviewSession, text: string): Promise<void> {
    try {
      this.sendResponse(ws, { type: 'generating_audio' });
      
      const buffer = await textToSpeechBuffer(text);
      session.invocationState.audioPlaybackActive = true;
      
      this.sendResponse(ws, {
        type: 'audio_response',
        audio: buffer.toString('base64'),
        text: text
      });
      
      this.sendResponse(ws, { type: 'audio_playback_started' });
    } catch (error) {
      console.error('TTS failure:', error);
      // Fallback: instruct client to use browser TTS (speechSynthesis)
      try {
        session.invocationState.audioPlaybackActive = true;
        this.sendResponse(ws, { type: 'speak_text', text });
        this.sendResponse(ws, { type: 'audio_playback_started' });
      } catch (err) {
        console.error('Error sending client-side TTS fallback:', err);
      }
    }
  }

  private async processSilence(
    ws: WebSocket,
    session: InterviewSession,
    sendToAgent?: (ws: WebSocket, session: InterviewSession, text: string, userCode?: string) => Promise<any>,
    synthesizeAudio?: (ws: WebSocket, session: InterviewSession, text: string) => Promise<void>,
    checkCodingInvocation?: (
      ws: WebSocket,
      session: InterviewSession,
      sendToAgent: (ws: WebSocket, session: InterviewSession, text: string, userCode?: string) => Promise<any>,
      text?: string,
      code?: string,
      language?: string,
      explanation?: string,
      synthesizeAudio?: (ws: WebSocket, session: InterviewSession, text: string) => Promise<void>,
      forceSpeechFinal?: boolean
    ) => Promise<void>
  ): Promise<void> {
    if (!session.currentTranscript.trim()) return;

    const text = session.currentTranscript.trim();
    console.log(`🔇 Silence detected. Processing transcript: "${text}"`);
    
    // For coding stage, update speech state and immediately ask CodingManager to evaluate VAD rules
    if (session.isInCodingStage) {
      this.updateSpeechState(session, text, true);
      session.currentTranscript = '';
      if (checkCodingInvocation && sendToAgent) {
        try {
          // Pass forceSpeechFinal=true to ensure invocation does not wait for idle timers
          await checkCodingInvocation(
            ws,
            session,
            sendToAgent,
            undefined,    // text
            undefined,    // code
            undefined,    // language
            undefined,    // explanation
            synthesizeAudio,
            true          // forceSpeechFinal
          );
        } catch (err) {
          console.error('[AudioManager] Error invoking coding VAD handler:', err);
        }
      }
    } else {
      // Normal behavior for non-coding stages
      console.log('[AudioManager] Emitting final_transcript:', text);
      this.sendResponse(ws, {
        type: 'final_transcript',
        transcript: text
      });
      session.currentTranscript = '';

      // If we have a sendToAgent callback, invoke the agent immediately (speech_final)
      if (sendToAgent) {
        try {
          const result = await sendToAgent(ws, session, text);
          if (result && result.response && result.response.assistant_message && synthesizeAudio) {
            await synthesizeAudio(ws, session, result.response.assistant_message);
          }
        } catch (err) {
          console.error('[AudioManager] Error invoking agent on speech_final:', err);
        }
      } else {
        // Otherwise, MessageProcessor.processSilence would be responsible for invocation
      }
    }
  }

  private updateSpeechState(session: InterviewSession, speech: string, isFinalTranscript: boolean = false): void {
    const now = Date.now();
    const hasNewContent = speech !== session.speechState.speechContent;
    
    if (hasNewContent || isFinalTranscript) {
      session.speechState.speechContent = speech;
      session.speechState.lastSpeech = now;
      session.speechState.hasNewSpeech = true;
      session.speechState.isSpeaking = !isFinalTranscript;
      
      if (session.speechState.silenceTimer) clearTimeout(session.speechState.silenceTimer);
      
      if (!isFinalTranscript) {
        session.speechState.silenceTimer = setTimeout(() => {
          session.speechState.isSpeaking = false;
  }, parseInt(process.env.SPEECH_SILENCE_THRESHOLD || '3000'));
      }
    }
  }

  private async processAudioQueue(session: InterviewSession): Promise<void> {
    while (session.isTranscribing && session.deepgramService) {
      if (session.audioQueue.length > 0) {
        const chunk = session.audioQueue.shift();
        if (chunk) {
          try {
            await session.deepgramService.sendAudio(Buffer.from(chunk));
          } catch (error) {
            console.error('Error processing audio chunk:', error);
          }
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 10));
      }
    }
  }

  private sendResponse(ws: WebSocket, response: WebSocketResponse): void {
    try {
      ws.send(JSON.stringify(response));
    } catch (error) {
      console.error('Error sending WebSocket response:', error);
    }
  }
}
