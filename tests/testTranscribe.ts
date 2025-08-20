import { AWSTranscribeStreaming } from "../lib/utils/awsTranscribe";

// ⚠️ Replace with your AWS creds (use env vars in prod, hardcoding only for quick test)
const credentials = {
  accessKeyId: "YOUR_ACCESS_KEY_ID",
  secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
};

async function main() {
  const transcriber = new AWSTranscribeStreaming(credentials, "us-west-2");
  console.log("🎤 Starting real-time transcription... Speak into your mic.");
  await transcriber.realTimeTranscribeFromMicrophone();
}

main().catch((err) => {
  console.error("❌ Error running transcription:", err);
});
