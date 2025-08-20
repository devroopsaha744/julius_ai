import { PollyClient, SynthesizeSpeechCommand } from "@aws-sdk/client-polly";
import { writeFileSync } from "fs";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const REGION = "us-east-1"; 

const polly = new PollyClient({
  region: REGION,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
  },
});

async function textToSpeech(text: string, outputFile: string) {
  const command = new SynthesizeSpeechCommand({
    OutputFormat: "mp3",
    Text: text,
    VoiceId: "Joanna",
  });

  const response = await polly.send(command);

  if (response.AudioStream) {
    const audioBuffer = await response.AudioStream.transformToByteArray();
    writeFileSync(outputFile, Buffer.from(audioBuffer));
    console.log(`✅ Audio file saved as ${outputFile}`);
  } else {
    console.error("❌ No audio stream received from Polly");
  }
}

// textToSpeech("Hello Devroop, this is AWS Polly speaking!", "output.mp3");
