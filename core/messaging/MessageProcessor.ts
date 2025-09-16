import type { InterviewSession } from '../interview/InterviewSession';
import type { WebSocketResponse } from '../types/SessionTypes';
import WebSocket from 'ws';

export class MessageProcessor {
  async processTextInput(
    ws: WebSocket, 
    session: InterviewSession, 
    text: string,
    sendToAgent: (ws: WebSocket, session: InterviewSession, text: string, userCode?: string) => Promise<any>,
    synthesizeAudio: (ws: WebSocket, session: InterviewSession, text: string) => Promise<void>
  ): Promise<void> {
    this.sendResponse(ws, {
      type: 'final_transcript',
      transcript: text
    });
    
    const result = await sendToAgent(ws, session, text);
    
    if (result && result.response && result.response.assistant_message) {
      await synthesizeAudio(ws, session, result.response.assistant_message);
    }
  }

  async processCodeInput(
    ws: WebSocket,
    session: InterviewSession,
    text: string,
    code?: string,
    language?: string,
    explanation?: string,
    sendToAgent?: (ws: WebSocket, session: InterviewSession, text: string, userCode?: string) => Promise<any>,
    synthesizeAudio?: (ws: WebSocket, session: InterviewSession, text: string) => Promise<void>
  ): Promise<void> {
    if (!sendToAgent || !synthesizeAudio) return;

    // For coding stage, this will be handled by CodingManager
    if (session.isInCodingStage) {
      return;
    }

    // Normal behavior for non-coding stages
    const fullMessage = language && explanation 
      ? `Language: ${language}\nExplanation: ${explanation}\n\nCode:\n${code || 'No code provided'}\n\nUser Message: ${text}`
      : text;
    
    this.sendResponse(ws, {
      type: 'final_transcript',
      transcript: fullMessage
    });
    
    const result = await sendToAgent(ws, session, fullMessage, code);
    
    if (result && result.response && result.response.assistant_message) {
      await synthesizeAudio(ws, session, result.response.assistant_message);
    }
  }

  async processSilence(
    ws: WebSocket,
    session: InterviewSession,
    sendToAgent: (ws: WebSocket, session: InterviewSession, text: string, userCode?: string) => Promise<any>,
    synthesizeAudio: (ws: WebSocket, session: InterviewSession, text: string) => Promise<void>
  ): Promise<void> {
    if (!session.currentTranscript.trim()) return;

    const text = session.currentTranscript.trim();
    console.log(`🔇 Silence detected. Processing transcript: "${text}"`);
    
    // For coding stage, this will be handled by CodingManager
    if (session.isInCodingStage) {
      return;
    }

    // Normal behavior for non-coding stages
    this.sendResponse(ws, {
      type: 'final_transcript',
      transcript: text
    });
    
    session.currentTranscript = '';
    
    const result = await sendToAgent(ws, session, text);
    
    if (result && result.response && result.response.assistant_message) {
      await synthesizeAudio(ws, session, result.response.assistant_message);
    }
  }

  handleAudioPlaybackFinished(ws: WebSocket, session: InterviewSession): void {
    console.log('🔇 Audio playback finished, enabling microphone...');
    session.invocationState.audioPlaybackActive = false;
    
    this.sendResponse(ws, {
      type: 'microphone_enabled',
      message: 'You can now speak'
    });
  }

  private sendResponse(ws: WebSocket, response: WebSocketResponse): void {
    try {
      ws.send(JSON.stringify(response));
    } catch (error) {
      console.error('Error sending WebSocket response:', error);
    }
  }
}
