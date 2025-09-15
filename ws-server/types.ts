import type { TranscribeStreamingClient } from "@aws-sdk/client-transcribe-streaming";
import type { InterviewOrchestrator } from "../lib/services/orchestrator";
import type { DeepgramSTTService } from "../lib/utils/deepgramSTT";

export interface CodingStreamState {
  lastKeystroke: number;
  codeContent: string;
  hasNewCode: boolean;
  isTyping: boolean;
  keystrokeTimer?: NodeJS.Timeout;
}

export interface SpeechStreamState {
  lastSpeech: number;
  speechContent: string;
  hasNewSpeech: boolean;
  isSpeaking: boolean;
  silenceTimer?: NodeJS.Timeout;
}

export interface InvocationState {
  lastInvocation: number;
  pendingInvocation: boolean;
  audioPlaybackActive: boolean;
  invocationTimer?: NodeJS.Timeout;
}

export interface ClientSession {
  sessionId: string;
  orchestrator: InterviewOrchestrator;
  transcribeClient: TranscribeStreamingClient;
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
