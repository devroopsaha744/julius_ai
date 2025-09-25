import { groqClient } from "../utils/groqclient";
import { InterviewRecommendationSchema, InterviewRecommendation } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";
import { addMessage, getMessages } from "../utils/redisSession";
import { extractText } from "../utils/extractText";
import Interview from "../models/Interview";
import mongoose from "mongoose";

export class RecommendationAgent {
  private prompt: string;
  private sessionId: string;
  private userId?: string;

  constructor(sessionId: string, userId?: string) {
    this.sessionId = sessionId;
    this.userId = userId;
    const promptPath = path.join(process.cwd(), "lib", "prompts", "recommendation.txt");
    this.prompt = fs.existsSync(promptPath) ? fs.readFileSync(promptPath, "utf-8") : "You are an expert recommendation assistant. Return JSON matching the InterviewRecommendation schema.";
  }

  async run(userMessage: string, resumeFilePath?: string): Promise<InterviewRecommendation> {
    await addMessage(this.sessionId, "user", userMessage, this.userId);

    // Fetch the interview reports from database
    let conversationalReport = null;
    let codingReport = null;
    let resumeContent = "";

    if (this.userId) {
      try {
        const interview = await Interview.findOne({ sessionId: this.sessionId });
        if (interview) {
          conversationalReport = interview.conversationalReport;
          codingReport = interview.codingReport;
          if (interview.resumeId) {
            // Fetch resume content if available
            const Resume = (await import("../models/Resume")).default;
            const resumeDoc = await Resume.findById(interview.resumeId);
            if (resumeDoc?.extractedText) {
              resumeContent = resumeDoc.extractedText;
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch interview data:', error);
      }
    }

    if (resumeFilePath) {
      try {
        resumeContent = await extractText(resumeFilePath);
      } catch (e) {
        try { resumeContent = fs.readFileSync(resumeFilePath, "utf-8"); } catch (err) { console.warn("RecommendationAgent: could not read resume file:", err); }
      }
    }

    const history = await getMessages(this.sessionId);

    const enhancedPrompt = `${this.prompt}\n\n**CANDIDATE RESUME:**\n${resumeContent}\n\n**CONVERSATIONAL INTERVIEW REPORT:**\n${conversationalReport ? JSON.stringify(conversationalReport, null, 2) : 'Not available'}\n\n**CODING TEST REPORT:**\n${codingReport ? JSON.stringify(codingReport, null, 2) : 'Not available'}\n\n**INTERVIEW CONTEXT / LAST MESSAGE:**\n${userMessage}\n\n**CONVERSATION HISTORY:**\n${history.map((h: any) => `${h.role}: ${h.content}`).join('\n')}\n\n**INSTRUCTIONS:**\n- Analyze both conversational and coding performance for comprehensive recommendations.\n- Provide specific, actionable guidance based on identified strengths and weaknesses.\n- Return only valid JSON conforming to the InterviewRecommendation schema.`;

    const completion = await groqClient.chat.completions.parse({
      model: "moonshotai/kimi-k2-instruct-0905",
      messages: [{ role: "system", content: enhancedPrompt }],
      temperature: 0.8,
      top_p: 0.95,
      response_format: zodResponseFormat(InterviewRecommendationSchema, "interview_recommendation")
    });

    const aiMessage = completion.choices[0].message.parsed as InterviewRecommendation | undefined;
    if (!aiMessage) throw new Error("RecommendationAgent: Failed to parse recommendation response");

    await addMessage(this.sessionId, "assistant", JSON.stringify(aiMessage), this.userId);

    // Save to database
    if (this.userId) {
      try {
        await Interview.findOneAndUpdate(
          { sessionId: this.sessionId },
          {
            userId: new mongoose.Types.ObjectId(this.userId),
            finalReport: aiMessage,
            status: 'completed',
            completedAt: new Date(),
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        console.error('Failed to save final report:', error);
      }
    }

    return aiMessage;
  }
}