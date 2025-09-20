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
      // defensive: ensure boilerplateCode is at least an empty string
      session.codingState.boilerplateCode = session.codingState.boilerplateCode || '';
      const hasChangedFromBoilerplate = code.trim() !== session.codingState.boilerplateCode.trim();
      if (!isFinalSubmission) {
        session.codingState.hasTyped = hasChangedFromBoilerplate;
      }
      session.codingState.isSubmitted = !!isFinalSubmission;
      
      // Reset existing keystroke debounce timer and set a new one so we can mark typing=false shortly after input stops.
      if (session.codingState.keystrokeTimer) {
        clearTimeout(session.codingState.keystrokeTimer);
        session.codingState.keystrokeTimer = undefined;
      }

      session.codingState.keystrokeTimer = setTimeout(() => {
        session.codingState.isTyping = false;
        session.codingState.keystrokeTimer = undefined;
      }, this.KEYSTROKE_DEBOUNCE);
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
  sendToAgent: (ws: WebSocket, session: InterviewSession, text: string, userCode?: string, codeSubmitted?: boolean, options?: { minimal?: boolean }) => Promise<any>,
    text?: string,
    code?: string,
    language?: string,
    explanation?: string,
    synthesizeAudio?: (ws: WebSocket, session: InterviewSession, text: string) => Promise<void>,
    forceSpeechFinal?: boolean
  ): Promise<void> {
    if (!session.isInCodingStage || session.invocationState.pendingInvocation) {
      console.log(`[CODING DEBUG] Skipping invocation check - isInCodingStage: ${session.isInCodingStage}, pendingInvocation: ${session.invocationState.pendingInvocation}`);
      return;
    }
    
    const now = Date.now();
    const timeSinceLastInvocation = now - session.invocationState.lastInvocation;
    if (timeSinceLastInvocation < 1000) {
      console.log(`[CODING DEBUG] Skipping - too soon since last invocation: ${timeSinceLastInvocation}ms`);
      return;
    }
    
    // Simple logic: Check if code differs from boilerplate
    const currentCode = session.codingState.codeContent || '';
    const boilerplateCode = session.codingState.boilerplateCode || '';
    const hasCodeChanges = currentCode.trim() !== boilerplateCode.trim();
    const isSubmitted = !!session.codingState.isSubmitted;
    const hasTranscript = !!(session.speechState.speechContent.trim() || text?.trim());
    const speechFinalTriggered = !!forceSpeechFinal;
    
    console.log(`[CODING DEBUG] Simple invocation check:
    - hasCodeChanges: ${hasCodeChanges}
    - isSubmitted: ${isSubmitted}
    - hasTranscript: ${hasTranscript}
    - speechFinalTriggered: ${speechFinalTriggered}
    - currentCode length: ${currentCode.length}
    - boilerplateCode length: ${boilerplateCode.length}`);
    
    let shouldInvoke = false;
    let invokeReason = '';
    
    // RULE 1: If NO code changes, use VAD-based invocation (like other stages)
    if (!hasCodeChanges && hasTranscript && speechFinalTriggered) {
      shouldInvoke = true;
      invokeReason = 'VAD triggered - no code changes';
    }
    
    // RULE 2: If there ARE code changes, only invoke on SUBMIT button click
    else if (hasCodeChanges && isSubmitted && hasTranscript) {
      shouldInvoke = true;
      invokeReason = 'Submit button clicked with code changes';
    }
    
    console.log(`[CODING DEBUG] Decision: shouldInvoke=${shouldInvoke}, reason=${invokeReason}`);
    
    if (shouldInvoke) {
      session.invocationState.pendingInvocation = true;
      session.invocationState.lastInvocation = now;

      this.sendResponse(ws, { type: 'llm_processing_started' });

      // Prepare the message - ONLY transcript and code (if submitted with changes)
      const transcript = session.speechState.speechContent.trim() || text?.trim() || '';
      let messageToAgent = transcript;
      let uiPayload = '';

      // If code was submitted with changes, include it
      if (hasCodeChanges && isSubmitted) {
        const codeToSend = code || currentCode;
        messageToAgent = transcript; // send only transcript as input text, code passed separately
        uiPayload = `<transcription>\n${transcript}\n</transcription>\n\ncode: ${codeToSend}`;

        console.log(`[CODING DEBUG] Sending transcript + code to agent (minimal mode)`);
        const result = await sendToAgent(ws, session, messageToAgent, codeToSend, true, { minimal: true });

        // Update boilerplate code after successful submission
        session.codingState.boilerplateCode = codeToSend;
        session.codingState.isSubmitted = false;
        session.codingState.hasTyped = false;
        console.log(`[CODING DEBUG] Updated boilerplate code and reset submission state`);

        // Send ONLY the formatted transcript+code back to UI
        this.sendResponse(ws, {
          type: 'final_transcript',
          transcript: uiPayload
        });

        // In coding-stage minimal mode we intentionally DO NOT synthesize or send assistant text/audio
        // to keep the response limited to the transcript + code only.
      } else {
        // VAD path - only transcript
        console.log(`[CODING DEBUG] Sending transcript only to agent (minimal mode)`);
        uiPayload = `<transcription>\n${transcript}\n</transcription>`;
        const result = await sendToAgent(ws, session, messageToAgent, undefined, false, { minimal: true });

        // Send ONLY the formatted transcript back to UI
        this.sendResponse(ws, {
          type: 'final_transcript',
          transcript: uiPayload
        });

        // In coding-stage minimal mode we intentionally DO NOT synthesize or send assistant text/audio
        // to keep the response limited to the transcript only.
      }

      // Reset states
      session.speechState.hasNewSpeech = false;
      session.codingState.hasNewCode = false;
      session.invocationState.pendingInvocation = false;
      
      this.sendResponse(ws, { type: 'llm_processing_finished' });
    }
  }

  createComprehensiveMessage(
    session: InterviewSession,
    text?: string,
    code?: string,
    language?: string,
    explanation?: string
  ): string {
    // This method is now deprecated in favor of inline formatting
    // Keeping for backward compatibility
    let message = '';
    
    if (session.speechState.speechContent.trim()) {
      message += `${session.speechState.speechContent.trim()}\n\n`;
    }
    
    if (text && text.trim() && text !== session.speechState.speechContent) {
      message += `${text.trim()}\n\n`;
    }
    
    if (code) {
      message += `code: ${code}\n\n`;
    }
    
    if (explanation && explanation.trim()) {
      message += `${explanation.trim()}\n\n`;
    }
    
    return message.trim() || 'No content provided';
  }

  resetDualStreamState(session: InterviewSession): void {
    // Keep boilerplate code but reset everything else
    const currentBoilerplate = session.codingState.boilerplateCode;
    
    session.codingState.codeContent = currentBoilerplate || '';
    session.codingState.hasNewCode = false;
    session.codingState.isTyping = false;
    session.codingState.hasTyped = false;
    session.codingState.lastKeystroke = 0;
    session.codingState.isSubmitted = false;
    session.codingState.submittedAt = undefined;
    
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
      console.log(`[CODING DEBUG] 🔄 Entering coding stage - Dual-stream tracking enabled`);
      console.log(`[CODING DEBUG] Initial boilerplate code: ${session.codingState.boilerplateCode?.substring(0, 50) || 'EMPTY'}...`);
      this.resetDualStreamState(session);
    } else if (!session.isInCodingStage && wasInCodingStage) {
      console.log(`[CODING DEBUG] 🔄 Exiting coding stage - Dual-stream tracking disabled`);
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
