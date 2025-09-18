/**
 * Enhanced WebSocket Client for Interview System
 * 
 * Usage Example:
 * 
 * const client = new InterviewWebSocketClient('ws://localhost:8080');
 * 
 * // Handle stage changes
 * client.on('stage_changed', (data) => {
 *   console.log(`Stage changed from ${data.previousStage} to ${data.newStage}`);
 * });
 * 
 * // Handle scoring results
 * client.on('scoring_result', (data) => {
 *   console.log('Interview scored:', data.scoring.overall.final_score);
 * });
 * 
 * // Upload resume first
 * await uploadResume(file, sessionId);
 * 
 * // Set resume path in WebSocket
 * client.setResumePath('/path/to/uploaded/resume.pdf');
 * 
 * // Start transcription
 * client.startTranscription();
 * 
 * // Send text input
 * client.sendTextInput("Hello, I'm ready for the interview");
 * 
 * // Send code (for coding rounds)
 * client.sendCodeInput("Here's my solution:", "function solution() { ... }");
 */

export class InterviewWebSocketClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private eventHandlers: Map<string, Function[]> = new Map();
  private pendingMessages: any[] = [];

  constructor(url: string) {
    this.url = url;
    this.connect();
  }

  private connect() {
    try {
      console.log(`Attempting to connect to WebSocket at: ${this.url}`);
      this.ws = new WebSocket(this.url);
      this.setupEventHandlers();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create WebSocket connection';
      console.error('Failed to connect to WebSocket:', errorMessage, error);
      this.emit('error', { message: errorMessage, originalError: error });
      this.handleReconnect();
    }
  }

  private setupEventHandlers() {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('Connected to interview WebSocket server');
      this.reconnectAttempts = 0;
      // Don't emit 'connected' here - wait for the server's connected message with sessionId
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('📨 Received WebSocket message:', data);
        // Store in pending buffer so late-registered handlers can replay
        this.pendingMessages.push(data);
        if (this.pendingMessages.length > 100) this.pendingMessages.shift();

        // Handle error messages specially to avoid conflicts with error event
        if (data.type === 'error') {
          console.error('❌ Server error:', data.message || 'Unknown server error');
          this.emit('server_error', data);
        } else {
          this.emit(data.type, data);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to parse message';
        console.error('Failed to parse WebSocket message:', errorMessage, event.data);
        this.emit('parse_error', { message: errorMessage, rawData: event.data });
      }
    };

    this.ws.onclose = (event) => {
      console.log(`WebSocket connection closed. Code: ${event.code}, Reason: ${event.reason}`);
      this.emit('disconnected', { code: event.code, reason: event.reason });
      this.handleReconnect();
    };

    this.ws.onerror = (error) => {
      const errorMessage = error instanceof Error ? error.message : 'Unknown WebSocket error';
      console.error('WebSocket error:', errorMessage, error);
      this.emit('error', { message: errorMessage, originalError: error });
    };
  }

  private handleReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      const delay = Math.pow(2, this.reconnectAttempts) * 1000; // Exponential backoff
      console.log(`Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
      
      setTimeout(() => {
        if (!this.isConnected()) {
          this.connect();
        }
      }, delay);
    } else {
      console.error('Max reconnection attempts reached. Please refresh the page.');
      this.emit('error', { 
        message: 'Unable to establish connection after multiple attempts. Please check if the server is running and refresh the page.',
        maxAttemptsReached: true 
      });
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getConnectionState(): string {
    if (!this.ws) return 'Not initialized';
    switch (this.ws.readyState) {
      case WebSocket.CONNECTING: return 'Connecting';
      case WebSocket.OPEN: return 'Connected';
      case WebSocket.CLOSING: return 'Closing';
      case WebSocket.CLOSED: return 'Closed';
      default: return 'Unknown';
    }
  }

  // Event handling
  on(event: string, handler: Function) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
    // Replay any pending messages of this event type that arrived before handler registration
    try {
      for (const msg of this.pendingMessages) {
        if (msg && msg.type === event) {
          try { handler(msg); } catch (e) { console.error('Error replaying pending WS message to handler:', e); }
        }
      }
    } catch (e) {
      console.error('Error while replaying pending messages:', e);
    }
  }

  off(event: string, handler: Function) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) {
        handlers.splice(index, 1);
      }
    }
  }

  private emit(event: string, data?: any) {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }
  }

  // WebSocket message sending methods
  private send(message: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  startTranscription() {
    this.send({ type: 'start_transcription' });
  }

  stopTranscription() {
    this.send({ type: 'stop_transcription' });
  }

  sendAudioChunk(audioData: ArrayBuffer) {
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(audioData)));
    this.send({ type: 'audio_chunk', data: base64Data });
  }

  sendTextInput(text: string) {
    this.send({ type: 'text_input', text });
  }

  sendCodeInput(text: string, code: string, language?: string, explanation?: string) {
    this.send({ 
      type: 'code_input', 
      text, 
      code,
      language: language || 'javascript',
      explanation: explanation || ''
    });
  }

  sendCodeKeystroke(code: string, language: string) {
    this.send({ 
      type: 'code_keystroke', 
      code,
      language 
    });
  }

  notifyAudioPlaybackFinished() {
    this.send({ type: 'audio_playback_finished' });
  }

  sendStageChange(stage: string) {
    this.send({ 
      type: 'stage_change', 
      stage 
    });
  }

  setResumePath(path: string) {
    this.send({ type: 'set_resume_path', path });
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Utility function for uploading resume
export async function uploadResume(file: File, sessionId: string) {
  const formData = new FormData();
  formData.append('resume', file);
  formData.append('sessionId', sessionId);

  const response = await fetch('/api/upload-resume', {
    method: 'POST',
    body: formData
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to upload resume');
  }

  return await response.json();
}

// Utility function for getting interview stage
export async function getInterviewStage(sessionId: string) {
  const response = await fetch(`/api/interview-stage?sessionId=${sessionId}`);
  
  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to get interview stage');
  }

  return await response.json();
}

// Utility function for generating reports
export async function generateReport(sessionId: string, resumeFilePath: string, reportType: 'scoring' | 'recommendation' | 'full' = 'full') {
  const response = await fetch('/api/generate-report', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sessionId,
      resumeFilePath,
      reportType
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to generate report');
  }

  return await response.json();
}
