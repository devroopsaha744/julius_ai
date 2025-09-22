import type { InterviewSession } from '../interview/InterviewSession';
import type { WebSocketResponse } from '../types/SessionTypes';
import WebSocket from 'ws';

export class AgentHandler {
  async sendToAgent(
    ws: WebSocket,
    session: InterviewSession,
    text: string,
    userCode?: string,
    codeSubmitted?: boolean,
    options?: { minimal?: boolean }
  ): Promise<any> {
    console.log(`[AGENT DEBUG] 🚨 sendToAgent CALLED - minimal=${options?.minimal}, text: ${text?.substring(0, 100)}..., userCode: ${userCode ? 'YES' : 'NO'}, codeSubmitted: ${codeSubmitted}`);

    session.invocationState.pendingInvocation = true;

    const minimal = options?.minimal === true;

    console.log(`[AGENT DEBUG] sendToAgent called - minimal=${minimal} - text: ${text?.substring(0, 100)}..., userCode: ${userCode ? 'YES' : 'NO'}`);

    if (!minimal) {
      this.sendResponse(ws, { type: 'processing' });
    }
    
    try {
      const currentStage = session.orchestrator.getCurrentStage();

      console.log(`[AGENT DEBUG] Current stage: ${currentStage}, Resume path: ${session.resumeFilePath}`);

      // In minimal mode we avoid emitting stage_info/agent_response/scoring/recommendation to the client
      if (!minimal) {
        this.sendResponse(ws, {
          type: 'stage_info',
          currentStage,
          stageChanged: false
        });
      }

      console.log(`[AGENT DEBUG] 🚀 CALLING orchestrator.processMessage`);
      const result = await session.orchestrator.processMessage(text, session.resumeFilePath, userCode, !!codeSubmitted);
      console.log(`[AGENT DEBUG] ✅ orchestrator.processMessage completed`);

      console.log(`[AGENT DEBUG] Orchestrator result - Stage: ${result.currentStage}, Changed: ${result.stageChanged}, Has response: ${!!result.response}`);

      if (!minimal) {
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
          console.log(`[AGENT DEBUG] Sending scoring result to client`);
          this.sendResponse(ws, {
            type: 'scoring_result',
            scoring: result.scoringResult
          });
        }

        if (result.recommendationResult) {
          console.log(`[AGENT DEBUG] Sending recommendation result to client`);
          this.sendResponse(ws, {
            type: 'recommendation_result',
            recommendation: result.recommendationResult
          });
        }
      }

      session.invocationState.pendingInvocation = false;
      if (!minimal) this.sendResponse(ws, { type: 'processing_finished' });

      return result;
    } catch (error) {
      session.invocationState.pendingInvocation = false;
      this.sendResponse(ws, {
        type: 'server_error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        currentStage: session.orchestrator.getCurrentStage()
      });

      if (!options?.minimal) this.sendResponse(ws, { type: 'processing_finished' });
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
