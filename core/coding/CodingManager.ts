import type { InterviewSession } from '../interview/InterviewSession';
import type { WebSocketResponse } from '../types/SessionTypes';
import WebSocket from 'ws';

export class CodingManager {
  private readonly CODE_IDLE_THRESHOLD = 1000; // 1 second as requested
  private readonly SPEECH_SILENCE_THRESHOLD = 3000; // 3 second Deepgram endpoint threshold
  private readonly KEYSTROKE_DEBOUNCE = 300; // 300ms debounce

  updateCodingState(session: InterviewSession, code: string, isFinalSubmission: boolean = false): void {
    const now = Date.now();
    const hasNewContent = code !== session.codingState.codeContent;
    
    if (hasNewContent || isFinalSubmission) {
      session.codingState.codeContent = code;
      session.codingState.lastKeystroke = now;
      session.codingState.hasNewCode = true;
      // mark typing state and submitted state
      session.codingState.isTyping = !isFinalSubmission;
      // Set hasTyped only if code content differs from boilerplate
      const hasChangedFromBoilerplate = code.trim() !== session.codingState.boilerplateCode.trim();
      if (!isFinalSubmission) {
        session.codingState.hasTyped = hasChangedFromBoilerplate;
      }
      session.codingState.isSubmitted = !!isFinalSubmission;
      
      if (session.codingState.keystrokeTimer) clearTimeout(session.codingState.keystrokeTimer);
    }
  }

  updateSpeechState(session: InterviewSession, speech: string, isFinalTranscript: boolean = false): void {
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
        }, this.SPEECH_SILENCE_THRESHOLD);
      }
    }
  }

  async checkDualStreamInvocation(
    ws: WebSocket,
    session: InterviewSession,
    sendToAgent: (ws: WebSocket, session: InterviewSession, text: string, userCode?: string) => Promise<any>,
    text?: string,
    code?: string,
    language?: string,
    explanation?: string,
    synthesizeAudio?: (ws: WebSocket, session: InterviewSession, text: string) => Promise<void>
  ): Promise<void> {
    if (!session.isInCodingStage || session.invocationState.pendingInvocation) return;
    
    const now = Date.now();
    const timeSinceLastInvocation = now - session.invocationState.lastInvocation;
    if (timeSinceLastInvocation < 1000) return;
    
    const speechIdle = !session.speechState.isSpeaking && 
                      (now - session.speechState.lastSpeech) > this.SPEECH_SILENCE_THRESHOLD;
    const codeIdle = !session.codingState.isTyping && 
                    (now - session.codingState.lastKeystroke) > this.CODE_IDLE_THRESHOLD;
    
  const hasNewSpeech = session.speechState.hasNewSpeech;
  const hasNewCode = session.codingState.hasNewCode;
  const hasNewContent = hasNewSpeech || hasNewCode;
    
    // Determine if submitted code exists (only submitted code should be forwarded)
    const codeSubmittedAvailable = !!(session.codingState.isSubmitted && session.codingState.codeContent && session.codingState.codeContent.length > 0);

    let shouldInvoke = false;

    // RULES:
    // 1) If user has not typed yet (hasTyped=false), speech-only uses VAD
    //    -> speechIdle triggers invocation with transcript-only or transcript+submitted-code
    // 2) If user has typed (hasTyped=true), only invoke on explicit Submit
    //    -> no auto-invocation during typing, only on submit

    const hasTyped = session.codingState.hasTyped;

    console.log(`[CodingManager] Checking invocation: speechIdle=${speechIdle}, codeIdle=${codeIdle}, hasNewSpeech=${hasNewSpeech}, hasNewCode=${hasNewCode}, codeSubmittedAvailable=${codeSubmittedAvailable}, hasTyped=${hasTyped}, text=${!!text}`);
    
    // Explicit submission always triggers (if code present)
    if (text && codeSubmittedAvailable) {
      shouldInvoke = true;
    }

    // If user has not typed yet, allow speech-only endpointing to trigger invocation
    else if (!hasTyped && speechIdle && (hasNewSpeech || codeSubmittedAvailable)) {
      shouldInvoke = true;
    }

    // If user has not typed yet and code is idle, allow submitted code to trigger even without speech
    else if (!hasTyped && codeIdle && hasNewCode && codeSubmittedAvailable && session.speechState.speechContent.length === 0) {
      shouldInvoke = true;
    }

    // Otherwise, DO NOT invoke while typing is active unless explicit submission occurs above
    console.log(`[CodingManager] shouldInvoke=${shouldInvoke}`);
    
    if (shouldInvoke) {
      session.invocationState.pendingInvocation = true;
      session.invocationState.lastInvocation = now;

      this.sendResponse(ws, { type: 'llm_processing_started' });

      // Only forward submitted code; if code present but not submitted, withhold content and only note draft presence
      const codeToSend = session.codingState.isSubmitted ? (code || session.codingState.codeContent) : undefined;
      const fullMessage = this.createComprehensiveMessage(session, text, codeToSend, language, explanation);

      // Reset 'hasNew' flags but retain isSubmitted until after successful invocation
      session.speechState.hasNewSpeech = false;
      session.codingState.hasNewCode = false;

      this.sendResponse(ws, {
        type: 'final_transcript',
        transcript: fullMessage
      });

      const result = await sendToAgent(ws, session, fullMessage, codeToSend);
      
      // Synthesize audio for the assistant's response if TTS is provided
      if (synthesizeAudio && result && result.response && result.response.assistant_message) {
        await synthesizeAudio(ws, session, result.response.assistant_message);
      }

      // After agent processed an explicit submitted invocation, clear submitted flag so subsequent typing behaves normally
      if (session.codingState.isSubmitted) {
        session.codingState.isSubmitted = false;
        session.codingState.submittedAt = undefined;
        session.codingState.hasTyped = false; // Reset hasTyped after submit
        // Update boilerplate to the submitted code for future comparisons
        if (codeToSend) {
          session.codingState.boilerplateCode = codeToSend;
        }
      }

      session.invocationState.pendingInvocation = false;
      this.sendResponse(ws, { type: 'llm_processing_finished' });
    } else {
      if (!session.invocationState.invocationTimer) {
        session.invocationState.invocationTimer = setTimeout(() => {
          session.invocationState.invocationTimer = undefined;
          this.checkDualStreamInvocation(ws, session, sendToAgent);
        }, Math.min(this.SPEECH_SILENCE_THRESHOLD, this.CODE_IDLE_THRESHOLD));
      }
    }
  }

  createComprehensiveMessage(
    session: InterviewSession, 
    text?: string, 
    code?: string, 
    language?: string, 
    explanation?: string
  ): string {
    let message = '';
    
    if (session.speechState.speechContent.trim()) {
      message += `Speech: ${session.speechState.speechContent.trim()}\n\n`;
    }
    
    if (text && text.trim() && text !== session.speechState.speechContent) {
      message += `Additional Input: ${text.trim()}\n\n`;
    }
    
    if (session.codingState.codeContent.trim() || code) {
      const codeContent = code || session.codingState.codeContent;
      const lang = language || '';
      message += 'Code (' + (language || 'unknown') + '):\n';
      message += '```' + lang + '\n' + codeContent + '\n```\n\n';
    }
    
    if (explanation && explanation.trim()) {
      message += `Explanation: ${explanation.trim()}\n\n`;
    }
    
    return message.trim() || 'No content provided';
  }

  resetDualStreamState(session: InterviewSession): void {
    session.codingState.codeContent = '';
    session.codingState.hasNewCode = false;
    session.codingState.isTyping = false;
    session.codingState.hasTyped = false;
    session.codingState.lastKeystroke = 0;
    
    session.speechState.speechContent = '';
    session.speechState.hasNewSpeech = false;
    session.speechState.isSpeaking = false;
    session.speechState.lastSpeech = 0;
    
    session.invocationState.lastInvocation = 0;
    session.invocationState.pendingInvocation = false;
    session.invocationState.audioPlaybackActive = false;
    
    this.cleanupDualStreamTimers(session);
  }

  cleanupDualStreamTimers(session: InterviewSession): void {
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

  handleStageChange(session: InterviewSession, stage: string): void {
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

  private sendResponse(ws: WebSocket, response: WebSocketResponse): void {
    try {
      ws.send(JSON.stringify(response));
    } catch (error) {
      console.error('Error sending WebSocket response:', error);
    }
  }
}
