import WebSocket from 'ws';
import { CODE_IDLE_THRESHOLD, KEYSTROKE_DEBOUNCE, SPEECH_SILENCE_THRESHOLD } from './constants';
import type { ClientSession } from './types';

export function updateCodingState(session: ClientSession, code: string, isFinalSubmission: boolean = false) {
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
      }, KEYSTROKE_DEBOUNCE);
    }
  }
}

export function updateSpeechState(session: ClientSession, speech: string, isFinalTranscript: boolean = false) {
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
      }, SPEECH_SILENCE_THRESHOLD);
    }
  }
}

export async function checkDualStreamInvocation(
  ws: WebSocket,
  session: ClientSession,
  createMessage: (text?: string, code?: string, language?: string, explanation?: string) => string,
  sendToAgent: (ws: WebSocket, session: ClientSession, text: string, userCode?: string) => Promise<any>,
  text?: string,
  code?: string,
  language?: string,
  explanation?: string
) {
  if (!session.isInCodingStage || session.invocationState.pendingInvocation) return;
  const now = Date.now();
  const timeSinceLastInvocation = now - session.invocationState.lastInvocation;
  if (timeSinceLastInvocation < 1000) return;
  const speechIdle = !session.speechState.isSpeaking && (now - session.speechState.lastSpeech) > SPEECH_SILENCE_THRESHOLD;
  const codeIdle = !session.codingState.isTyping && (now - session.codingState.lastKeystroke) > CODE_IDLE_THRESHOLD;
  const hasNewSpeech = session.speechState.hasNewSpeech;
  const hasNewCode = session.codingState.hasNewCode;
  const hasNewContent = hasNewSpeech || hasNewCode;
  let shouldInvoke = false;
  if (text && code) shouldInvoke = true;
  else if (speechIdle && codeIdle && hasNewContent) shouldInvoke = true;
  else if (speechIdle && hasNewSpeech && session.codingState.codeContent.length === 0) shouldInvoke = true;
  else if (codeIdle && hasNewCode && session.speechState.speechContent.length === 0) shouldInvoke = true;
  if (shouldInvoke) {
    session.invocationState.pendingInvocation = true;
    session.invocationState.lastInvocation = now;
    ws.send(JSON.stringify({ type: 'llm_processing_started' }));
  const fullMessage = createMessage(text, code, language, explanation);
    session.speechState.hasNewSpeech = false;
    session.codingState.hasNewCode = false;
    ws.send(JSON.stringify({ type: 'final_transcript', transcript: fullMessage }));
    await sendToAgent(ws, session, fullMessage, session.codingState.codeContent);
    session.invocationState.pendingInvocation = false;
    ws.send(JSON.stringify({ type: 'llm_processing_finished' }));
  } else {
    if (!session.invocationState.invocationTimer) {
      session.invocationState.invocationTimer = setTimeout(() => {
        session.invocationState.invocationTimer = undefined;
        checkDualStreamInvocation(ws, session, createMessage, sendToAgent);
      }, Math.min(SPEECH_SILENCE_THRESHOLD, CODE_IDLE_THRESHOLD));
    }
  }
}

export function resetDualStreamState(session: ClientSession) {
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
  cleanupDualStreamTimers(session);
}

export function cleanupDualStreamTimers(session: ClientSession) {
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
