import { groqClient } from "../utils/groqclient";
import { InterviewStepSchema, InterviewStep } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";
import { addMessage, getMessages } from "../utils/redisSession";

export class BehaviouralAgent {
  private prompt: string;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const promptPath = path.join(process.cwd(), "lib", "prompts", "behave.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");
  }

  async run(userMessage: string) {
    // Store the user's message
    await addMessage(this.sessionId, "user", userMessage);

    // Get conversation history
    const history = await getMessages(this.sessionId);

    // Build the message array for the model
    const messages = [
      { role: "system", content: this.prompt },
      ...history.map(m => ({ role: m.role, content: m.content }))
    ];

    // Model call
    const completion = await groqClient.chat.completions.parse({
      model: "openai/gpt-oss-120b",
      messages,
      response_format: zodResponseFormat(InterviewStepSchema, "behavioural_step")
    });

    const aiMessage = completion.choices[0].message.parsed as InterviewStep;

    // Store AI's reply (text only)
    await addMessage(this.sessionId, "assistant", aiMessage.assistant_message);

    return aiMessage;
  }
}
