import { groqClient } from "../utils/groqclient";
import { InterviewScoringSchema, InterviewScoring } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";
import { addMessage, getMessages } from "../utils/redisSession";
import { extractText } from "../utils/extractText";

export class ScoringAgent {
  private prompt: string;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const promptPath = path.join(process.cwd(), "lib", "prompts", "score.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");
  }

  async run(userMessage: string, resumeFilePath: string) {
    const resumeContent = await extractText(resumeFilePath);

    await addMessage(this.sessionId, "user", userMessage);

    const history = await getMessages(this.sessionId);

    const messages = [
      {
        role: "system",
        content: `${this.prompt}\n\nResume Content:\n${resumeContent}`
      },
      ...history
    ];

    const completion = await groqClient.chat.completions.parse({
      model: "openai/gpt-oss-120b",
      messages,
      response_format: zodResponseFormat(InterviewScoringSchema, "interview_scoring")
    });

    const aiMessage = completion.choices[0].message.parsed as InterviewScoring;

    await addMessage(this.sessionId, "assistant", JSON.stringify(aiMessage));

    return aiMessage;
  }
}
