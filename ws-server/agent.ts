import WebSocket from 'ws';
import type { ClientSession } from './types';

// sendToAgent now returns the orchestrator result so the caller (server.ts)
// can decide whether to synthesize audio or handle additional behavior.
export async function sendToAgent(ws: WebSocket, session: ClientSession, text: string, userCode?: string) {
  session.invocationState.pendingInvocation = true;
  ws.send(JSON.stringify({ type: 'processing' }));
  try {
    const currentStage = session.orchestrator.getCurrentStage();
    ws.send(JSON.stringify({ type: 'stage_info', currentStage, stageChanged: false }));
    const result = await session.orchestrator.processMessage(text, session.resumeFilePath, userCode);
    if (result.stageChanged) {
      ws.send(JSON.stringify({ type: 'stage_changed', previousStage: currentStage, newStage: result.currentStage, stageChanged: true }));
    }
    ws.send(JSON.stringify({ type: 'agent_response', response: result.response, currentStage: result.currentStage }));
    if (result.scoringResult) ws.send(JSON.stringify({ type: 'scoring_result', scoring: result.scoringResult }));
    if (result.recommendationResult) ws.send(JSON.stringify({ type: 'recommendation_result', recommendation: result.recommendationResult }));
    session.invocationState.pendingInvocation = false;
    ws.send(JSON.stringify({ type: 'processing_finished' }));
    return result;
  } catch (error) {
    session.invocationState.pendingInvocation = false;
    ws.send(JSON.stringify({ type: 'server_error', message: error instanceof Error ? error.message : 'Unknown error occurred', stage: session.orchestrator.getCurrentStage() }));
    ws.send(JSON.stringify({ type: 'processing_finished' }));
    return null;
  }
}

export function createComprehensiveMessage(session: ClientSession, text?: string, code?: string, language?: string, explanation?: string): string {
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
