import { groqClient } from "../utils/groqclient";
import { InterviewStepSchema, InterviewStep } from "../models/models";
import { ChatCompletionMessageParam } from "openai/resources";
import fs from "fs";
import path from "path";
import { addMessage, getMessages } from "../utils/redisSession";
import { MongoClient } from "mongodb";

export class UnifiedInterviewAgent {
      private prompt: string = "";
     private sessionId: string;
     private userId?: string;

     constructor(sessionId: string, userId?: string) {
       this.sessionId = sessionId;
       this.userId = userId;
     }

     private async getPrompt(): Promise<string> {
       if (this.prompt) return this.prompt;

       // Try to load custom prompt first
       try {
         const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/julis-ai';
         const client = new MongoClient(mongoUri);
         await client.connect();
         const db = client.db();
         const collection = db.collection('recruiter_configs');

         const recruiterId = 'default_recruiter';
         const config = await collection.findOne({ recruiterId });

         if (config?.prompts?.interview) {
           await client.close();
           this.prompt = config.prompts.interview;
           return this.prompt;
         }

         await client.close();
       } catch (error) {
         console.error('Failed to load custom prompt, using default:', error);
       }

       // Fall back to default prompt
       const promptPath = path.join(process.cwd(), "lib", "prompts", "unified_interview.txt");
       this.prompt = fs.readFileSync(promptPath, "utf-8");
       return this.prompt;
     }

    /**
     * Run the unified agent.
     * @param userMessage - incoming user message
     * @param userCode - optional code (not used in current flow)
     * @param currentState - one of 'greet','resume','cs','behave','wrap_up','end'
     * @param currentSubstate - specific substate within the current state
     * @param resumeContent - optional plain-text resume content to include in context
     */
    async run(userMessage: string, userCode?: string, currentState: string = "greet", currentSubstate: string = "greet_intro", resumeContent?: string, codeSubmitted: boolean = false) {
      console.log(`[UNIFIED_AGENT DEBUG] 🚨 run called - state: ${currentState}, codeSubmitted: ${codeSubmitted}, userCode: ${userCode ? 'YES' : 'NO'}`);

      // Store the user's message
      await addMessage(this.sessionId, "user", userMessage, this.userId);

      // Retrieve conversation history (we keep full history but instruct model to focus on current state/substate)
      const history = await getMessages(this.sessionId);

      // Get the prompt (custom or default)
      const prompt = await this.getPrompt();

      // Build system prompt with current state/substate instructions
      const enhancedPrompt = `${prompt}\n\n**CURRENT STATE:** ${currentState}\n**CURRENT SUBSTATE:** ${currentSubstate}\n\n**CANDIDATE RESUME (if provided):**\n${resumeContent || 'N/A'}\n\n**CONVERSATION HISTORY (full):**\n${history.map((m: any) => `${m.role}: ${m.content}`).join('\n')}\n\nIMPORTANT: Return a JSON object that exactly matches the InterviewStep schema (fields: assistant_message (string), state (string), substate (string)). Return no additional text or commentary.\n`;

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: enhancedPrompt },
        ...history.map((m: any) => ({ role: m.role as any, content: m.content }))
      ];

      // Model call with JSON response
      console.log(`[UNIFIED_AGENT DEBUG] 🚀 MAKING LLM CALL to groqClient`);
      const completion = await groqClient.chat.completions.create({
        model: "openai/gpt-oss-120b",
        messages,
        temperature: 0.8,
        top_p: 0.95,
        response_format: { type: "json_object" }
      });
      console.log(`[UNIFIED_AGENT DEBUG] ✅ LLM CALL completed`);

      const raw = completion.choices[0].message.content;
      if (!raw) throw new Error("Failed to get AI response content");

      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error(`Failed to JSON.parse AI response: ${(err as Error).message}`);
      }

      const validation = InterviewStepSchema.safeParse(parsed);
      if (!validation.success) {
        const issues = validation.error.format();
        throw new Error(`AI response did not match InterviewStep schema: ${JSON.stringify(issues)}`);
      }

      const aiMessage = validation.data;

      console.log(`[UNIFIED_AGENT DEBUG] AI response - state: ${aiMessage.state}, message: ${aiMessage.assistant_message?.substring(0, 50)}...`);

      // Store assistant reply (assistant_message only)
      await addMessage(this.sessionId, "assistant", aiMessage.assistant_message, this.userId);

      return aiMessage;
    }
  }