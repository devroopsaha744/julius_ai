import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream
} from "@aws-sdk/client-transcribe-streaming";
import mic from "mic";
import { PassThrough } from "stream";

export async function startRealtimeTranscription() {
  console.log("AWS_ACCESS_KEY:", process.env.AWS_ACCESS_KEY ? "✓ Present" : "✗ Missing");
  console.log("AWS_SECRET_KEY:", process.env.AWS_SECRET_KEY ? "✓ Present" : "✗ Missing");

  const client = new TranscribeStreamingClient({
    region: "us-east-1",
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY || "",
      secretAccessKey: process.env.AWS_SECRET_KEY || ""
    }
  });

  const audioStream = new PassThrough();

  const microphone = mic({
    rate: "16000",
    channels: "1",
    bitwidth: "16",
    encoding: "signed-integer",
    endian: "little",
    device: "default"
  });

  const micInputStream = microphone.getAudioStream();

  micInputStream.on("data", (data: Buffer) => {
    audioStream.write(data);
  });

  micInputStream.on("error", (err: any) =>
    console.error("Mic error:", err)
  );

  microphone.start();

  const command = new StartStreamTranscriptionCommand({
    LanguageCode: "en-US",
    MediaEncoding: "pcm",
    MediaSampleRateHertz: 16000,
    AudioStream: (async function* () {
      const chunkSize = 32000; // 32 KB
      let buffer = Buffer.alloc(0);

      for await (const rawChunk of audioStream) {
        buffer = Buffer.concat([buffer, rawChunk as Buffer]);

        while (buffer.length >= chunkSize) {
          const piece = buffer.slice(0, chunkSize);
          buffer = buffer.slice(chunkSize);
          yield {
            AudioEvent: { AudioChunk: piece }
          } as AudioStream;
        }
      }

      if (buffer.length > 0) {
        yield { AudioEvent: { AudioChunk: buffer } } as AudioStream;
      }
    })()
  });

  try {
    const response = await client.send(command);

    if (response.TranscriptResultStream) {
      for await (const event of response.TranscriptResultStream) {
        if (event.TranscriptEvent) {
          const results = event.TranscriptEvent.Transcript?.Results || [];
          for (const result of results) {
            if (result.Alternatives?.length) {
              const transcript = result.Alternatives[0].Transcript;
              if (transcript) {
                console.log("Transcript:", transcript);
              }
            }
          }
        }
      }
    }
  } catch (error) {
    console.error("Transcription error:", error);
  } finally {
    microphone.stop();
  }
}
