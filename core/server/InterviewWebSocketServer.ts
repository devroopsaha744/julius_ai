import WebSocket, { WebSocketServer } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';

import { SessionManager, type InterviewSession } from '../interview/InterviewSession';
import { AudioManager } from '../audio/AudioManager';
import { CodingManager } from '../coding/CodingManager';
import { MessageProcessor } from '../messaging/MessageProcessor';
import { AgentHandler } from '../agent/AgentHandler';
import type { WebSocketMessage } from '../types/SessionTypes';

dotenv.config({ path: '.env.local' });

export class InterviewWebSocketServer {
  private wss: WebSocketServer;
  private sessionManager: SessionManager;
  private audioManager: AudioManager;
  private codingManager: CodingManager;
  private messageProcessor: MessageProcessor;
  private agentHandler: AgentHandler;

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.sessionManager = new SessionManager();
    this.audioManager = new AudioManager();
    this.codingManager = new CodingManager();
    this.messageProcessor = new MessageProcessor();
    this.agentHandler = new AgentHandler();
    
    this.setupServer();
  }

  private setupServer(): void {
    console.log('🚀 WebSocket server starting...');

    this.wss.on('connection', (ws: WebSocket) => {
      const sessionId = uuidv4();
      
      // No AWS Transcribe client - using Deepgram for STT
      const session = this.sessionManager.createSession(sessionId);
      
      ws.send(JSON.stringify({ type: 'connected', sessionId }));

      ws.on('message', async (data: Buffer) => this.handleMessage(ws, session, data));
      ws.on('close', () => this.handleDisconnect(session));
      ws.on('error', () => this.handleDisconnect(session));
    });

    this.wss.on('listening', () => {
      console.log(`🎯 WebSocket server listening on port ${this.wss.options.port}`);
    });
  }

  private async handleMessage(ws: WebSocket, session: InterviewSession, data: Buffer): Promise<void> {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'start_transcription':
          await this.audioManager.startDeepgramTranscription(
            ws,
            session,
            this.agentHandler.sendToAgent.bind(this.agentHandler),
            this.audioManager.synthesizeAndSendAudio.bind(this.audioManager),
            this.codingManager.checkDualStreamInvocation.bind(this.codingManager) // allow AudioManager to trigger coding VAD immediately
          );
          break;
          
        case 'audio_chunk':
          const chunk = Buffer.from(message.data, 'base64');
          await this.audioManager.processAudioChunk(ws, session, chunk);
          break;
          
        case 'stop_transcription':
          await this.audioManager.stopDeepgramTranscription(ws, session);
          break;
          
        case 'text_input':
          await this.messageProcessor.processTextInput(
            ws, 
            session, 
            message.text!, 
            this.agentHandler.sendToAgent.bind(this.agentHandler),
            this.audioManager.synthesizeAndSendAudio.bind(this.audioManager)
          );
          break;
          
        case 'code_input':
          // If we're in the coding stage, treat this as a submission: mark code submitted
          // and trigger the coding manager to invoke the agent with the transcript + submitted code.
          if (session.isInCodingStage) {
            // Update language if provided and update boilerplate accordingly
            if (message.language && message.language !== session.currentLanguage) {
              session.currentLanguage = message.language;
              // Update boilerplate for new language
              const boilerplates: Record<string, string> = {
                'python': `# Python Solution
def solution():
    # Your code here
    return result

# Test your function
print(solution())`,
                'javascript': `// JavaScript Solution
function solution() {
    // Your code here
    return result;
}

// Test your function
console.log(solution());`,
                'java': `// Java Solution
public class Solution {
    public static void main(String[] args) {
        // Your code here
        System.out.println(solution());
    }
    
    public static int solution() {
        // Your code here
        return 0;
    }
}`,
                'cpp': `// C++ Solution
#include <iostream>

int solution() {
    // Your code here
    return 0;
}

int main() {
    std::cout << solution() << std::endl;
    return 0;
}`,
                'csharp': `// C# Solution
using System;

class Solution {
    static void Main() {
        Console.WriteLine(SolutionMethod());
    }
    
    static int SolutionMethod() {
        // Your code here
        return 0;
    }
}`
              };
              session.codingState.boilerplateCode = boilerplates[message.language.toLowerCase()] || boilerplates['python'];
            }
            
            // Mark submitted code on the session
            this.codingManager.updateCodingState(session, message.code || '', true);

            // Immediately attempt dual-stream invocation with explicit submission
            await this.codingManager.checkDualStreamInvocation(
              ws,
              session,
              this.agentHandler.sendToAgent.bind(this.agentHandler),
              message.text,
              message.code,
              message.language,
              message.explanation,
              this.audioManager.synthesizeAndSendAudio.bind(this.audioManager)
            );
          } else {
            await this.messageProcessor.processCodeInput(
              ws,
              session,
              message.text!,
              message.code,
              message.language,
              message.explanation,
              this.agentHandler.sendToAgent.bind(this.agentHandler),
              this.audioManager.synthesizeAndSendAudio.bind(this.audioManager)
            );
          }
          break;
          
        case 'code_keystroke':
          await this.handleCodeKeystroke(ws, session, message.code!, message.language);
          break;
          
        case 'audio_playback_finished':
          this.messageProcessor.handleAudioPlaybackFinished(ws, session);
          break;
          
        case 'stage_change':
          // Initialize boilerplate code when entering coding stage
          if (message.stage === 'coding' && !session.codingState.boilerplateCode) {
            const defaultBoilerplate = `# Python Solution
def solution():
    # Your code here
    return result

# Test your function
print(solution())`;
            session.codingState.boilerplateCode = defaultBoilerplate;
            console.log(`[WS_SERVER DEBUG] Initialized boilerplate code for coding stage`);
          }
          this.codingManager.handleStageChange(session, message.stage!);
          break;
          
        case 'set_resume_path':
          session.resumeFilePath = message.path;
          ws.send(JSON.stringify({ type: 'resume_path_set', path: message.path }));
          break;
          
        default:
          ws.send(JSON.stringify({ type: 'server_error', message: 'Unknown message type' }));
      }
    } catch (error) {
      ws.send(JSON.stringify({ 
        type: 'server_error', 
        message: 'Invalid message format' 
      }));
    }
  }

  private async handleCodeKeystroke(
    ws: WebSocket, 
    session: InterviewSession, 
    code: string, 
    language?: string
  ): Promise<void> {
    if (!session.isInCodingStage) return;
    
    console.log(`⌨️ Code keystroke tracked - Length: ${code.length}, Language: ${language}`);
    
    this.codingManager.updateCodingState(session, code, false);
    
    await this.codingManager.checkDualStreamInvocation(
      ws,
      session,
      this.agentHandler.sendToAgent.bind(this.agentHandler),
      undefined, // text
      code,      // code
      language,  // language
      undefined, // explanation
      this.audioManager.synthesizeAndSendAudio.bind(this.audioManager) // TTS callback - was missing!
    );
  }

  private handleDisconnect(session: InterviewSession): void {
    this.sessionManager.deleteSession(session.sessionId);
  }

  // Public method to get server info
  getServerInfo(): { port: number; clients: number } {
    return {
      port: this.wss.options.port as number,
      clients: this.wss.clients.size
    };
  }

  // Public method to gracefully shutdown
  async shutdown(): Promise<void> {
    return new Promise((resolve) => {
      this.wss.close(() => {
        console.log('WebSocket server closed');
        resolve();
      });
    });
  }
}

// Export default instance
const PORT = process.env.WS_PORT ? parseInt(process.env.WS_PORT) : 8080;
export default new InterviewWebSocketServer(PORT);
