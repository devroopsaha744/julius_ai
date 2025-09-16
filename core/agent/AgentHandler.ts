import type { InterviewSession } from '../interview/InterviewSession';
import type { WebSocketResponse } from '../types/SessionTypes';
import WebSocket from 'ws';

export class AgentHandler {
  async sendToAgent(
    ws: WebSocket, 
    session: InterviewSession, 
    text: string, 
    userCode?: string
  ): Promise<any> {
    session.invocationState.pendingInvocation = true;
    
    this.sendResponse(ws, { type: 'processing' });
    
    try {
      const currentStage = session.orchestrator.getCurrentStage();
      
      this.sendResponse(ws, {
        type: 'stage_info',
        currentStage,
        stageChanged: false
      });
      
      const result = await session.orchestrator.processMessage(text, session.resumeFilePath, userCode);
      
      if (result.stageChanged) {
        this.sendResponse(ws, {
          type: 'stage_changed',
          previousStage: currentStage,
          newStage: result.currentStage,
          stageChanged: true
        });
      }
      
      this.sendResponse(ws, {
        type: 'agent_response',
        response: result.response,
        currentStage: result.currentStage
      });
      
      if (result.scoringResult) {
        this.sendResponse(ws, {
          type: 'scoring_result',
          scoring: result.scoringResult
        });
      }
      
      if (result.recommendationResult) {
        this.sendResponse(ws, {
          type: 'recommendation_result',
          recommendation: result.recommendationResult
        });
      }
      
      session.invocationState.pendingInvocation = false;
      this.sendResponse(ws, { type: 'processing_finished' });
      
      return result;
    } catch (error) {
      session.invocationState.pendingInvocation = false;
      
      this.sendResponse(ws, {
        type: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        currentStage: session.orchestrator.getCurrentStage()
      });
      
      this.sendResponse(ws, { type: 'processing_finished' });
      return null;
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
