// Centralized configuration and thresholds for the WS server

export const SILENCE_TIMEOUT = 1500; // ms - Deepgram endpoint threshold
export const SAMPLE_RATE = 48000; // Hz - Deepgram sample rate
export const SPEECH_SILENCE_THRESHOLD = 1000; // ms - Deepgram endpoint threshold (500ms-1sec)
export const CODE_IDLE_THRESHOLD = 30000; // ms - 30 seconds as requested
export const KEYSTROKE_DEBOUNCE = 300; // ms - Immediate feedback debounce
