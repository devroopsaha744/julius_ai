import { groqClient } from "../utils/groqclient";
import { InterviewStepSchema, InterviewStep } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";
import { addMessage, getMessages } from "../utils/redisSession";
import { textToSpeechBuffer } from "../utils/elevenlabsTTS";

export class GreetingAgent {
  private prompt: string;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const promptPath = path.join(process.cwd(), "lib", "prompts", "greet.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");
  }

  async run(userMessage: string) {
    // Store user's message
    await addMessage(this.sessionId, "user", userMessage);

    // Get conversation history
    const history = await getMessages(this.sessionId);

    // Build message array for the model
    const messages = [
      { role: "system", content: this.prompt },
      ...history
    ];

    // Model call
    const completion = await groqClient.chat.completions.parse({
      model: "openai/gpt-oss-120b",
      messages,
      response_format: zodResponseFormat(InterviewStepSchema, "interview_step")
    });

    const aiMessage = completion.choices[0].message.parsed as InterviewStep;

    // Store AI's reply
    await addMessage(this.sessionId, "assistant", aiMessage.assistant_message);

    // Synthesize audio for the assistant message and attach as base64 (non-blocking)
    try {
      const audioBuf = await textToSpeechBuffer(aiMessage.assistant_message || '');
      (aiMessage as any).audio_buffer_base64 = audioBuf.toString('base64');
    } catch (e) {
      // If TTS fails, continue without audio
      console.error('TTS synthesis failed for greeting agent:', e);
    }

    return aiMessage;
  }
}
