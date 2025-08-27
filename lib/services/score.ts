import { groqClient } from "../utils/groqclient";
import { InterviewScoringSchema, InterviewScoring } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";
import { getMessages } from "../utils/redisSession";

export class ScoringAgent {
  private prompt: string;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const promptPath = path.join(process.cwd(), "lib", "prompts", "score.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");
  }

  async generateScore(): Promise<InterviewScoring> {
    try {
      // Get the complete conversation history from Redis
      const conversationHistory = await getMessages(this.sessionId);
      
      if (!conversationHistory || conversationHistory.length === 0) {
        throw new Error("No conversation history found for scoring");
      }

      // Format the conversation history for the prompt
      const formattedHistory = this.formatConversationHistory(conversationHistory);

      // Build the message array for the model
      const messages = [
        { 
          role: "system" as const, 
          content: `${this.prompt}\n\n${formattedHistory}` 
        },
        {
          role: "user" as const,
          content: "Please analyze the above conversation history and provide a comprehensive scoring evaluation following the JSON schema format."
        }
      ];

      // Make the API call to generate scoring
      const completion = await groqClient.chat.completions.parse({
        model: "gemini-2.0-flash-lite-001",
        messages,
        response_format: zodResponseFormat(InterviewScoringSchema, "interview_scoring")
      });

      const scoringResult = completion.choices[0].message.parsed as InterviewScoring;

      // Validate that we got a proper response
      if (!scoringResult) {
        throw new Error("Failed to generate scoring - no parsed response received");
      }

      return scoringResult;

    } catch (error) {
      console.error("Error generating interview score:", error);
      
      // Return a fallback scoring structure in case of error
      return this.generateFallbackScore();
    }
  }

  private formatConversationHistory(history: any[]): string {
    let formattedHistory = "=== COMPLETE INTERVIEW CONVERSATION HISTORY ===\n\n";
    
    history.forEach((message, index) => {
      const role = message.role === "user" ? "CANDIDATE" : "INTERVIEWER (Julius)";
      const timestamp = message.timestamp ? new Date(message.timestamp).toLocaleString() : "Unknown time";
      
      formattedHistory += `[${index + 1}] ${role} (${timestamp}):\n`;
      formattedHistory += `${message.content}\n`;
      
      // Include code if present (for coding round)
      if (message.code) {
        formattedHistory += `\n--- CODE SUBMITTED ---\n${message.code}\n--- END CODE ---\n`;
      }
      
      formattedHistory += "\n" + "=".repeat(80) + "\n\n";
    });

    formattedHistory += "=== END OF CONVERSATION HISTORY ===\n";
    return formattedHistory;
  }

  private generateFallbackScore(): InterviewScoring {
    // Generate unique IDs
    const candidateId = `CAND_${Date.now()}`;
    const interviewId = `INT_${Date.now()}`;

    return {
      candidate_id: candidateId,
      interview_id: interviewId,
      stages: {
        greeting: {
          score: 5,
          criteria: {
            confidence: 5,
            communication: 5,
            professionalism: 5,
            engagement: 5
          },
          notes: "Unable to evaluate - scoring system error occurred."
        },
        resume_discussion: {
          score: 5,
          criteria: {
            relevance_of_experience: 5,
            depth_of_projects: 5,
            clarity_in_explanation: 5,
            technical_alignment: 5
          },
          notes: "Unable to evaluate - scoring system error occurred."
        },
        coding_round: {
          score: 5,
          criteria: {
            problem_solving: 5,
            code_correctness: 5,
            optimization: 5,
            readability: 5,
            edge_case_handling: 5,
            explanation: 5
          },
          artifacts: {
            question: "No questions recorded due to error",
            code: "No code recorded due to error",
            explanation: "No explanation recorded due to error",
            test_results: {
              passed: 0,
              failed: 0,
              total: 0
            }
          },
          notes: "Unable to evaluate - scoring system error occurred."
        },
        technical_cs_round: {
          score: 5,
          criteria: {
            core_cs_fundamentals: 5,
            system_design: 5,
            algorithms_and_ds: 5,
            ml_ai_domain_knowledge: 5,
            clarity_and_depth: 5
          },
          qna: [],
          notes: "Unable to evaluate - scoring system error occurred."
        },
        behavioral_round: {
          score: 5,
          criteria: {
            teamwork: 5,
            leadership: 5,
            conflict_resolution: 5,
            adaptability: 5,
            culture_fit: 5,
            communication: 5
          },
          qna: [],
          notes: "Unable to evaluate - scoring system error occurred."
        },
        wrap_up: {
          score: 5,
          criteria: {
            final_impression: 5,
            questions_asked: 5,
            closing_communication: 5
          },
          notes: "Unable to evaluate - scoring system error occurred."
        }
      },
      overall: {
        final_score: 50,
        recommendation: "Maybe",
        strengths: ["Unable to determine due to scoring error"],
        weaknesses: ["Unable to determine due to scoring error"]
      }
    };
  }

  // Utility method to get session ID
  getSessionId(): string {
    return this.sessionId;
  }

  // Method to validate scoring result
  private validateScoring(scoring: InterviewScoring): boolean {
    try {
      InterviewScoringSchema.parse(scoring);
      return true;
    } catch (error) {
      console.error("Scoring validation failed:", error);
      return false;
    }
  }

  // Method to calculate weighted final score manually (for verification)
  private calculateWeightedScore(stages: InterviewScoring['stages']): number {
    const weights = {
      greeting: 0.10,
      resume_discussion: 0.15,
      coding_round: 0.30,
      technical_cs_round: 0.25,
      behavioral_round: 0.15,
      wrap_up: 0.05
    };

    const weightedSum = 
      (stages.greeting.score * weights.greeting) +
      (stages.resume_discussion.score * weights.resume_discussion) +
      (stages.coding_round.score * weights.coding_round) +
      (stages.technical_cs_round.score * weights.technical_cs_round) +
      (stages.behavioral_round.score * weights.behavioral_round) +
      (stages.wrap_up.score * weights.wrap_up);

    return Math.round(weightedSum * 10); // Convert to 1-100 scale
  }
}
