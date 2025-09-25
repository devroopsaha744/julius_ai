import { groqClient } from "../utils/groqclient";
import { InterviewScoringSchema, InterviewScoring } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";
import { addMessage, getMessages } from "../utils/redisSession";
import { extractText } from "../utils/extractText";
import Interview from "../models/Interview";
import mongoose from "mongoose";

export class ScoringAgent {
  private prompt: string;
  private sessionId: string;
  private userId?: string;

  constructor(sessionId: string, userId?: string) {
    this.sessionId = sessionId;
    this.userId = userId;
    const promptPath = path.join(process.cwd(), "lib", "prompts", "score.txt");
    this.prompt = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, "utf-8") : "You are an expert scoring assistant. Return JSON that matches the InterviewScoring schema.";
  }

  async run(userMessage: string, resumeFilePath?: string): Promise<InterviewScoring> {
    // persist user message
    await addMessage(this.sessionId, "user", userMessage, this.userId);

    // load resume
    let resumeContent = "";
    if (resumeFilePath) {
      try {
        resumeContent = await extractText(resumeFilePath);
      } catch (e) {
        try {
          resumeContent = fs.readFileSync(resumeFilePath, "utf-8");
        } catch (err) {
          console.warn("ScoringAgent: could not read resume file:", err);
        }
      }
    }

    const history = await getMessages(this.sessionId);

    const enhancedPrompt = `${this.prompt}\n\n**CANDIDATE RESUME:**\n${resumeContent}\n\n**INTERVIEW CONTEXT / LAST MESSAGE:**\n${userMessage}\n\n**CONVERSATION HISTORY:**\n${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}\n\n**INSTRUCTIONS:**\n- Provide a single JSON object that exactly matches the InterviewScoring schema exported from models.ts.\n- Include stage-wise breakdowns and an overall final_score (1-100) plus strengths/weaknesses and a recommendation (Hire|No Hire|Maybe).\n- Return only valid JSON that conforms to the schema.`;

    const completion = await groqClient.chat.completions.parse({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "system", content: enhancedPrompt }],
      temperature: 0.8,
      top_p: 0.95,
      response_format: zodResponseFormat(InterviewScoringSchema, "interview_scoring")
    });

    const aiMessage = completion.choices[0].message.parsed as InterviewScoring | undefined;
    if (!aiMessage) throw new Error("ScoringAgent: Failed to parse scoring response");

    await addMessage(this.sessionId, "assistant", JSON.stringify(aiMessage), this.userId);

    // Save to database
    if (this.userId) {
      try {
        await Interview.findOneAndUpdate(
          { sessionId: this.sessionId },
          {
            userId: new mongoose.Types.ObjectId(this.userId),
            conversationalReport: aiMessage,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        console.error('Failed to save conversational report:', error);
      }
    }

    return aiMessage;
  }
}