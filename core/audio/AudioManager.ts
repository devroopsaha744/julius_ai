import { DeepgramSTTService } from '../../lib/utils/deepgramSTT';
import { textToSpeechBuffer } from '../../lib/utils/elevenlabsTTS';
import type { InterviewSession } from '../interview/InterviewSession';
import type { WebSocketResponse } from '../types/SessionTypes';
import WebSocket from 'ws';

export class AudioManager {
  private deepgramService: DeepgramSTTService | null = null;

  async startDeepgramTranscription(ws: WebSocket, session: InterviewSession): Promise<void> {
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
        if (!transcript.trim()) return;
        
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
          this.processSilence(ws, session);
        }, parseInt(process.env.SILENCE_TIMEOUT || '1500'));
      },
      (err) => {
        this.sendResponse(ws, {
          type: 'server_error',
          message: `Deepgram error: ${err}`
        });
      },
      (utterance) => {
        this.processSilence(ws, session);
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

  async processAudioChunk(session: InterviewSession, audioChunk: Buffer): Promise<void> {
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
      // Continue without audio
    }
  }

  private async processSilence(ws: WebSocket, session: InterviewSession): Promise<void> {
    if (!session.currentTranscript.trim()) return;

    const text = session.currentTranscript.trim();
    console.log(`🔇 Silence detected. Processing transcript: "${text}"`);
    
    // For coding stage, update speech state and check dual-stream invocation
    if (session.isInCodingStage) {
      this.updateSpeechState(session, text, true);
      session.currentTranscript = '';
      // This will be handled by the CodingManager
    } else {
      // Normal behavior for non-coding stages
      this.sendResponse(ws, {
        type: 'final_transcript',
        transcript: text
      });
      session.currentTranscript = '';
      // This will be handled by the MessageProcessor
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
        }, parseInt(process.env.SPEECH_SILENCE_THRESHOLD || '2000'));
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
