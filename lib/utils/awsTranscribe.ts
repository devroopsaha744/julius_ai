import {
  TranscribeStreamingClient,
  StartStreamTranscriptionCommand,
  AudioStream,
} from "@aws-sdk/client-transcribe-streaming";

const SAMPLE_RATE = 16000;
const BYTES_PER_SAMPLE = 2;
const CHANNEL_NUMS = 1;
const CHUNK_SIZE = 1024 * 8;
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

  async realTimeTranscribeFromMicrophone(): Promise<void> {
    try {
      const audioStream = this.createAudioStreamFromMicrophone();

      const response = await this.client.send(
        new StartStreamTranscriptionCommand({
          LanguageCode: "en-US",
          MediaSampleRateHertz: SAMPLE_RATE,
          MediaEncoding: "pcm",
          AudioStream: audioStream,
        })
      );

      if (response.TranscriptResultStream) {
        for await (const event of response.TranscriptResultStream) {
          if (event.TranscriptEvent) {
            for (const result of event.TranscriptEvent.Transcript?.Results ?? []) {
              for (const alt of result.Alternatives ?? []) {
                console.log(`${result.IsPartial ? "[Partial]" : "[Final]"} ${alt.Transcript}`);
              }
            }
          }
        }
      }

      console.log("Transcription ended");
    } catch (error) {
      console.error("Real-time transcription error:", error);
    }
  }

  private async* createAudioStreamFromMicrophone(): AsyncIterable<AudioStream> {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        sampleRate: SAMPLE_RATE,
        channelCount: CHANNEL_NUMS,
        sampleSize: BYTES_PER_SAMPLE * 8,
      },
    });

    const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
    const source = audioContext.createMediaStreamSource(stream);
    const processor = audioContext.createScriptProcessor(CHUNK_SIZE, CHANNEL_NUMS, CHANNEL_NUMS);

    const queue: AudioStream[] = [];
    let resolver: (() => void) | null = null;

    processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      const pcmData = new Int16Array(inputData.length);

      for (let i = 0; i < inputData.length; i++) {
        const sample = Math.max(-1, Math.min(1, inputData[i]));
        pcmData[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      }

      const audioChunk = new Uint8Array(pcmData.buffer);
      queue.push({ AudioEvent: { AudioChunk: audioChunk } });

      if (resolver) {
        resolver();
        resolver = null;
      }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    while (true) {
      if (queue.length > 0) {
        yield queue.shift()!;
      } else {
        await new Promise<void>((res) => (resolver = res));
      }
    }
  }
}

export { AWSTranscribeStreaming };
