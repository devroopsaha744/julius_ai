import AWS from 'aws-sdk';
import { Readable } from 'stream';
import crypto from 'crypto';

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

const transcribeStream = new AWS.TranscribeService();

interface TranscriptEvent {
  transcript?: {
    results?: Array<{
      alternatives?: Array<{
        transcript?: string;
      }>;
      is_final?: boolean;
    }>;
  };
}

export class AWSTranscribeStream {
  private transcribeClient: AWS.TranscribeService;
  private stream: any;
  private sessionId: string;
  
  constructor() {
    this.transcribeClient = new AWS.TranscribeService();
    this.sessionId = crypto.randomBytes(16).toString('hex');
  }

  async startStream(onTranscript: (text: string, isFinal: boolean) => void, onError: (error: any) => void) {
    try {
      // For AWS Transcribe Streaming, we need to use the AWS SDK v3 or implement WebSocket connection
      // This is a simplified implementation - in production, you'd use AWS Transcribe Streaming
      
      const params = {
        LanguageCode: 'en-US',
        MediaEncoding: 'pcm',
        MediaSampleRateHertz: 16000,
        AudioStream: this.createAudioStream(onTranscript, onError)
      };

      // Note: AWS Transcribe Streaming requires WebSocket connection
      // This is a placeholder for the actual implementation
      console.log('AWS Transcribe stream starting...');
      
    } catch (error) {
      onError(error);
    }
  }

  private createAudioStream(onTranscript: (text: string, isFinal: boolean) => void, onError: (error: any) => void) {
    const audioStream = new Readable({
      read() {}
    });

    // In a real implementation, you'd set up the WebSocket connection to AWS Transcribe
    // and handle the streaming transcription responses
    
    return audioStream;
  }

  writeAudio(audioData: Buffer) {
    // Write audio data to the stream
    if (this.stream) {
      this.stream.write(audioData);
    }
  }

  endStream() {
    if (this.stream) {
      this.stream.end();
    }
  }
}

// Alternative implementation using AWS Transcribe WebSocket
export class AWSTranscribeWebSocket {
  private ws: WebSocket | null = null;
  private sessionId: string;

  constructor() {
    this.sessionId = crypto.randomBytes(16).toString('hex');
  }

  async connect(onTranscript: (text: string, isFinal: boolean) => void, onError: (error: any) => void) {
    try {
      // Generate the signed WebSocket URL for AWS Transcribe
      const endpoint = await this.createPresignedUrl();
      
      this.ws = new WebSocket(endpoint);
      
      this.ws.onopen = () => {
        console.log('Connected to AWS Transcribe');
      };

      this.ws.onmessage = (event) => {
        try {
          const response = JSON.parse(event.data);
          
          if (response.Transcript && response.Transcript.Results) {
            for (const result of response.Transcript.Results) {
              if (result.Alternatives && result.Alternatives.length > 0) {
                const transcript = result.Alternatives[0].Transcript || '';
                const isFinal = !result.IsPartial;
                
                if (transcript) {
                  onTranscript(transcript, isFinal);
                }
              }
            }
          }
        } catch (error) {
          console.error('Error parsing transcription response:', error);
        }
      };

      this.ws.onerror = (error) => {
        onError(error);
      };

      this.ws.onclose = () => {
        console.log('AWS Transcribe connection closed');
      };

    } catch (error) {
      onError(error);
    }
  }

  private async createPresignedUrl(): Promise<string> {
    // This creates a presigned URL for AWS Transcribe WebSocket connection
    const region = process.env.AWS_REGION || 'us-east-1';
    const endpoint = `wss://transcribestreaming.${region}.amazonaws.com:8443`;
    
    // In production, you'd need to properly sign the WebSocket URL
    // This is a simplified version
    const params = new URLSearchParams({
      'language-code': 'en-US',
      'media-encoding': 'pcm',
      'sample-rate': '16000'
    });

    return `${endpoint}/stream-transcription-websocket?${params.toString()}`;
  }

  sendAudio(audioData: Buffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // Convert audio data to the format expected by AWS Transcribe
      const audioEvent = {
        AudioEvent: {
          AudioChunk: audioData.toString('base64')
        }
      };
      
      this.ws.send(JSON.stringify(audioEvent));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Simplified version that works with the existing WebSocket server structure
export class SimpleAWSTranscribe {
  private transcribeClient: AWS.TranscribeService;
  private audioBuffer: Buffer[] = [];
  private isProcessing = false;

  constructor() {
    this.transcribeClient = new AWS.TranscribeService();
  }

  async processAudio(audioData: Buffer, onTranscript: (text: string, isFinal: boolean) => void) {
    this.audioBuffer.push(audioData);
    
    // Process audio in chunks to simulate real-time transcription
    if (!this.isProcessing && this.audioBuffer.length > 10) {
      this.isProcessing = true;
      
      try {
        const combinedAudio = Buffer.concat(this.audioBuffer);
        this.audioBuffer = [];
        
        // In a real implementation, you'd send this to AWS Transcribe Streaming
        // For now, we'll use a mock response
        setTimeout(() => {
          onTranscript('Processing with AWS Transcribe...', false);
          this.isProcessing = false;
        }, 100);
        
      } catch (error) {
        console.error('AWS Transcribe error:', error);
        this.isProcessing = false;
      }
    }
  }
}

export default {
  AWSTranscribeStream,
  AWSTranscribeWebSocket,
  SimpleAWSTranscribe
};