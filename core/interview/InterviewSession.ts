import { InterviewOrchestrator } from '../../lib/services/orchestrator';
import { DeepgramSTTService } from '../../lib/utils/deepgramSTT';
import type { CodingStreamState, SpeechStreamState, InvocationState } from '../types/SessionTypes';

export interface InterviewSession {
  sessionId: string;
  orchestrator: InterviewOrchestrator;
  // No AWS Transcribe client; using DeepgramSTTService instead (created on demand)
  currentTranscript: string;
  isTranscribing: boolean;
  silenceTimer?: NodeJS.Timeout;
  audioQueue: Uint8Array[];
  transcribeStream?: any;
  deepgramService?: DeepgramSTTService | null;
  resumeFilePath?: string;
  codingState: CodingStreamState;
  speechState: SpeechStreamState;
  invocationState: InvocationState;
  isInCodingStage: boolean;
}

export class SessionManager {
  private sessions: Map<string, InterviewSession> = new Map();

  createSession(sessionId: string): InterviewSession {
    const session: InterviewSession = {
      sessionId,
      orchestrator: new InterviewOrchestrator(sessionId),
      currentTranscript: '',
      isTranscribing: false,
      audioQueue: [],
      codingState: {
        lastKeystroke: 0,
        codeContent: '',
        hasNewCode: false,
        isTyping: false
      },
      speechState: {
        lastSpeech: 0,
        speechContent: '',
        hasNewSpeech: false,
        isSpeaking: false
      },
      invocationState: {
        lastInvocation: 0,
        pendingInvocation: false,
        audioPlaybackActive: false
      },
      isInCodingStage: false
      // deepgramService and silenceTimer are optional and set during transcription
    };

    this.sessions.set(sessionId, session);
    return session;
  }

  getSession(sessionId: string): InterviewSession | undefined {
    return this.sessions.get(sessionId);
  }

  deleteSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.silenceTimer) clearTimeout(session.silenceTimer);
      session.isTranscribing = false;
      if (session.transcribeStream) session.transcribeStream.destroy?.();
      if (session.deepgramService) {
        session.deepgramService.disconnect().catch(() => {});
        session.deepgramService = null as any;
      }
      this.sessions.delete(sessionId);
    }
  }

  getAllSessions(): Map<string, InterviewSession> {
    return this.sessions;
  }
}
