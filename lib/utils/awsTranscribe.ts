import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream
} from "@aws-sdk/client-transcribe-streaming";
import { PassThrough } from "stream";

const MAX_CHUNK_BYTES = 32000; // AWS limit

export function createTranscribeClient() {
  return new TranscribeStreamingClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
    },
  });
}

export async function startTranscriptionStream(audioStream: PassThrough) {
  const client = createTranscribeClient();

  async function* chunkedAudioStream() {
    let bufferQueue: Buffer[] = [];
    let bufferLen = 0;

    for await (const chunk of audioStream) {
      bufferQueue.push(chunk as Buffer);
      bufferLen += (chunk as Buffer).length;

      while (bufferLen >= MAX_CHUNK_BYTES) {
        let frame = Buffer.concat(bufferQueue);
        const toSend = frame.slice(0, MAX_CHUNK_BYTES);
        yield { AudioEvent: { AudioChunk: toSend } } as AudioStream;

        const remaining = frame.slice(MAX_CHUNK_BYTES);
        bufferQueue = remaining.length ? [remaining] : [];
        bufferLen = remaining.length;
      }
    }

    // Send remaining buffer if any
    if (bufferLen > 0) {
      let frame = Buffer.concat(bufferQueue);
      yield { AudioEvent: { AudioChunk: frame } } as AudioStream;
    }
  }

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: "en-US",
    MediaEncoding: "pcm",
    MediaSampleRateHertz: 16000,
    AudioStream: chunkedAudioStream(),
  });

  const response = await client.send(command);
  return response;
}
