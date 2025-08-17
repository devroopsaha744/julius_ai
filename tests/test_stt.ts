import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' }); 

import { startRealtimeTranscription } from "../lib/utils/awsStt";

(async () => {
  console.log("🎤 Speak into your mic, transcription will appear below...\n");
  await startRealtimeTranscription();
})();