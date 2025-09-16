import type { InterviewSession } from '../interview/InterviewSession';
import type { WebSocketResponse } from '../types/SessionTypes';
import WebSocket from 'ws';

export class CodingManager {
  private readonly CODE_IDLE_THRESHOLD = 30000; // 30 seconds as requested
  private readonly SPEECH_SILENCE_THRESHOLD = 1000; // 1 second Deepgram endpoint threshold
  private readonly KEYSTROKE_DEBOUNCE = 300; // 300ms debounce

  updateCodingState(session: InterviewSession, code: string, isFinalSubmission: boolean = false): void {
    const now = Date.now();
    const hasNewContent = code !== session.codingState.codeContent;
    
    if (hasNewContent || isFinalSubmission) {
      session.codingState.codeContent = code;
      session.codingState.lastKeystroke = now;
      session.codingState.hasNewCode = true;
      session.codingState.isTyping = !isFinalSubmission;
      
      if (session.codingState.keystrokeTimer) clearTimeout(session.codingState.keystrokeTimer);
      
      if (!isFinalSubmission) {
        session.codingState.keystrokeTimer = setTimeout(() => {
          session.codingState.isTyping = false;
        }, this.KEYSTROKE_DEBOUNCE);
      }
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
    explanation?: string
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
    
    let shouldInvoke = false;
    
    // Invoke if both text and code are provided
    if (text && code) {
      shouldInvoke = true;
    }
    // Invoke if both speech and code are idle and there's new content
    else if (speechIdle && codeIdle && hasNewContent) {
      shouldInvoke = true;
    }
    // Invoke if speech is idle and there's new speech but no code
    else if (speechIdle && hasNewSpeech && session.codingState.codeContent.length === 0) {
      shouldInvoke = true;
    }
    // Invoke if code is idle and there's new code but no speech
    else if (codeIdle && hasNewCode && session.speechState.speechContent.length === 0) {
      shouldInvoke = true;
    }
    
    if (shouldInvoke) {
      session.invocationState.pendingInvocation = true;
      session.invocationState.lastInvocation = now;
      
      this.sendResponse(ws, { type: 'llm_processing_started' });
      
      const fullMessage = this.createComprehensiveMessage(session, text, code, language, explanation);
      
      session.speechState.hasNewSpeech = false;
      session.codingState.hasNewCode = false;
      
      this.sendResponse(ws, {
        type: 'final_transcript',
        transcript: fullMessage
      });
      
      await sendToAgent(ws, session, fullMessage, session.codingState.codeContent);
      
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
