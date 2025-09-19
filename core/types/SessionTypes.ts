export interface CodingStreamState {
  lastKeystroke: number;
  codeContent: string;
  hasNewCode: boolean;
  isTyping: boolean;
  hasTyped: boolean;
  // Boilerplate code for comparison (updated on submit)
  boilerplateCode: string;
  // True if the user explicitly submitted the code for review
  isSubmitted?: boolean;
  // Timestamp when code was submitted
  submittedAt?: number;
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

export interface WebSocketMessage {
  type: string;
  data?: any;
  text?: string;
  code?: string;
  language?: string;
  explanation?: string;
  stage?: string;
  path?: string;
}

export interface WebSocketResponse {
  type: string;
  sessionId?: string;
  transcript?: string;
  isPartial?: boolean;
  response?: any;
  currentStage?: string;
  stageChanged?: boolean;
  previousStage?: string;
  newStage?: string;
  scoring?: any;
  recommendation?: any;
  audio?: string;
  text?: string;
  message?: string;
  provider?: string;
}
