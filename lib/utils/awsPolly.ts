import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

const REGION = "us-east-1";

const polly = new PollyClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

async function textToSpeechBuffer(text: string): Promise<Buffer> {
  const command = new SynthesizeSpeechCommand({
    OutputFormat: "mp3",
    Text: text,
    VoiceId: "Matthew", // male voice
  });

  const response = await polly.send(command);
  if (!response.AudioStream) throw new Error("No audio stream received from Polly");

  const audioBuffer = await response.AudioStream.transformToByteArray();
  return Buffer.from(audioBuffer);
}

export { textToSpeechBuffer };
