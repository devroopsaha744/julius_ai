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
    this.prompt = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, "utf-8") : "You are an expert recommendation assistant. Return JSON matching the InterviewRecommendation schema.";
  }

  async run(userMessage: string, resumeFilePath?: string): Promise<InterviewRecommendation> {
    await addMessage(this.sessionId, "user", userMessage);

    let resumeContent = "";
    if (resumeFilePath) {
      try {
        resumeContent = await extractText(resumeFilePath);
      } catch (e) {
        try { resumeContent = fs.readFileSync(resumeFilePath, "utf-8"); } catch (err) { console.warn("RecommendationAgent: could not read resume file:", err); }
      }
    }

    const history = await getMessages(this.sessionId);

    const enhancedPrompt = `${this.prompt}\n\n**CANDIDATE RESUME:**\n${resumeContent}\n\n**INTERVIEW CONTEXT / LAST MESSAGE:**\n${userMessage}\n\n**CONVERSATION HISTORY:**\n${history.map(h => `${h.role}: ${h.content}`).join('\n')}\n\n**INSTRUCTIONS:**\n- Provide recommendations that match the InterviewRecommendation schema.\n- Include actionable tips, resources, and a concise finalAdvice.\n- Return only valid JSON conforming to the schema.`;

    const completion = await groqClient.chat.completions.parse({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "system", content: enhancedPrompt }],
      response_format: zodResponseFormat(InterviewRecommendationSchema, "interview_recommendation")
    });

    const aiMessage = completion.choices[0].message.parsed as InterviewRecommendation | undefined;
    if (!aiMessage) throw new Error("RecommendationAgent: Failed to parse recommendation response");

    await addMessage(this.sessionId, "assistant", JSON.stringify(aiMessage));

    return aiMessage;
  }
}