import { groqClient } from "../utils/groqclient";
import { InterviewStepSchema, InterviewStep } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";
import { addMessage, getMessages } from "../utils/redisSession";

export class CodingAgent {
  private prompt: string;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const promptPath = path.join(process.cwd(), "lib", "prompts", "coding.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");
  }

  async run(userMessage: string, userCode?: string) {
    // Store the user's message (and optional code)
    await addMessage(this.sessionId, "user", userMessage + "/n" + userCode);

    // Get conversation history
    const history = await getMessages(this.sessionId);

    // Build the message array for the model, including code in the user's message if present
    const messages = [
      { role: "system", content: this.prompt },
      ...history.map(m => {
        if (m.role === "user" && m.code) {
          return { role: m.role, content: `${m.content}\n\n<code>\n${m.code}\n</code>` };
        }
        return { role: m.role, content: m.content };
      })
    ];

    // Model call
    const completion = await groqClient.chat.completions.parse({
      model: "gemini-2.0-flash-lite-001",
      messages,
      response_format: zodResponseFormat(InterviewStepSchema, "coding_step")
    });

    const aiMessage = completion.choices[0].message.parsed as InterviewStep;

    // Store AI's reply (text only)
    await addMessage(this.sessionId, "assistant", aiMessage.assistant_message);

    return aiMessage;
  }
}
