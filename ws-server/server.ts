
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { WebSocketServer, WebSocket } from "ws";
import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream,
} from "@aws-sdk/client-transcribe-streaming";

const SAMPLE_RATE = 16000;
const REGION = "us-west-2";

interface AWSCredentials {
  accessKeyId: string;
  secretAccessKey: string;
}

class AWSTranscribeStreaming {
  private client: TranscribeStreamingClient;

  constructor(credentials: AWSCredentials, region: string = REGION) {
    this.client = new TranscribeStreamingClient({
      region: region,
      credentials: {
        accessKeyId: credentials.accessKeyId,
        secretAccessKey: credentials.secretAccessKey,
      },
    });
  }

  async *realTimeTranscribe(
    audioStream: AsyncIterable<Uint8Array>
  ): AsyncGenerator<string, void, unknown> {
    try {
      const response = await this.client.send(
        new StartStreamTranscriptionCommand({
          LanguageCode: "en-US",
          MediaSampleRateHertz: SAMPLE_RATE,
          MediaEncoding: "pcm",
          AudioStream: (async function* () {
            for await (const chunk of audioStream) {
              yield { AudioEvent: { AudioChunk: chunk } } as AudioStream;
            }
          })(),
        })
      );

      if (response.TranscriptResultStream) {
        for await (const event of response.TranscriptResultStream) {
          if (event.TranscriptEvent) {
            for (const result of event.TranscriptEvent.Transcript?.Results ?? []) {
              for (const alt of result.Alternatives ?? []) {
                yield `${result.IsPartial ? "[Partial]" : "[Final]"} ${alt.Transcript}`;
              }
            }
          }
        }
      }
    } catch (error) {
      console.error("Real-time transcription error:", error);
      throw error;
    }
  }
}

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws: WebSocket) => {
  console.log("🔗 Client connected");

  const transcriber = new AWSTranscribeStreaming({
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  });

  // Create a queue-based audio stream
  const audioQueue: Uint8Array[] = [];
  let streamEnded = false;
  let resolver: (() => void) | null = null;

  const audioStream = (async function* () {
    while (!streamEnded || audioQueue.length > 0) {
      if (audioQueue.length > 0) {
        yield audioQueue.shift()!;
      } else {
        await new Promise<void>((resolve) => {
          resolver = resolve;
        });
      }
    }
  })();

  // Handle incoming audio data
  ws.on("message", (message) => {
    if (message instanceof Buffer) {
      audioQueue.push(new Uint8Array(message));
      if (resolver) {
        resolver();
        resolver = null;
      }
    }
  });

  // Process transcription and send results back to client
  (async () => {
    try {
      for await (const text of transcriber.realTimeTranscribe(audioStream)) {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ transcript: text }));
        }
      }
    } catch (error) {
      console.error("Transcription error:", error);
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ error: "Transcription failed" }));
      }
    }
  })();

  ws.on("close", () => {
    console.log("❌ Client disconnected");
    streamEnded = true;
    if (resolver) {
      resolver();
      resolver = null;
    }
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
    streamEnded = true;
    if (resolver) {
      resolver();
      resolver = null;
    }
  });
});

console.log("🚀 WebSocket server running on ws://localhost:8080");