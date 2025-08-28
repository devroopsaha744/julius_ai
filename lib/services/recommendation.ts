import { groqClient } from "../utils/groqclient";
import { InterviewRecommendationSchema, InterviewRecommendation } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";
import { addMessage, getMessages } from "../utils/redisSession";
import { extractText } from "../utils/extractText";

export class RecommendationAgent {
  private prompt: string;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const promptPath = path.join(process.cwd(), "lib", "prompts", "recommendation.txt");
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
      model: "gemini-2.0-flash-lite-001",
      messages,
      response_format: zodResponseFormat(InterviewRecommendationSchema, "interview_recommendation")
    });

    const aiMessage = completion.choices[0].message.parsed as InterviewRecommendation;

    await addMessage(this.sessionId, "assistant", JSON.stringify(aiMessage));

    return aiMessage;
  }
}
