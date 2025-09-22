import { groqClient } from "../utils/groqclient";
import { InterviewStepSchema, InterviewStep } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import { ChatCompletionMessageParam } from "openai/resources";
import fs from "fs";
import path from "path";
import { addMessage, getMessages } from "../utils/redisSession";

export class UnifiedInterviewAgent {
  private prompt: string;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const promptPath = path.join(process.cwd(), "lib", "prompts", "unified_interview.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");
  }

  /**
   * Run the unified agent.
   * @param userMessage - incoming user message
  import { groqClient } from "../utils/groqclient";
  import { InterviewStepSchema, InterviewStep } from "../models/models";
  import { zodResponseFormat } from "openai/helpers/zod";
  import { ChatCompletionMessageParam } from "openai/resources";
  import fs from "fs";
  import path from "path";
  import { addMessage, getMessages } from "../utils/redisSession";

  export class UnifiedInterviewAgent {
    private prompt: string;
    private sessionId: string;

    constructor(sessionId: string) {
      this.sessionId = sessionId;
      const promptPath = path.join(process.cwd(), "lib", "prompts", "unified_interview.txt");
      this.prompt = fs.readFileSync(promptPath, "utf-8");
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
      await addMessage(this.sessionId, "user", userMessage);

      // Retrieve conversation history (we keep full history but instruct model to focus on current state/substate)
      const history = await getMessages(this.sessionId);

      // Build system prompt with current state/substate instructions
      const enhancedPrompt = `${this.prompt}\n\n**CURRENT STATE:** ${currentState}\n**CURRENT SUBSTATE:** ${currentSubstate}\n\n**CANDIDATE RESUME (if provided):**\n${resumeContent || 'N/A'}\n\n**CONVERSATION HISTORY (full):**\n${history.map(m => `${m.role}: ${m.content}`).join('\n')}\n\nIMPORTANT: Return a JSON object that exactly matches the InterviewStep schema (fields: assistant_message (string), state (string), substate (string)). Return no additional text or commentary.\n`;

      const messages: ChatCompletionMessageParam[] = [
        { role: "system", content: enhancedPrompt },
        ...history.map(m => ({ role: m.role as any, content: m.content }))
      ];

      // Model call with zod response parsing
      console.log(`[UNIFIED_AGENT DEBUG] 🚀 MAKING LLM CALL to groqClient`);
      const completion = await groqClient.chat.completions.parse({
        model: "openai/gpt-oss-120b",
        messages,
        response_format: zodResponseFormat(InterviewStepSchema, "interview_step")
      });
      console.log(`[UNIFIED_AGENT DEBUG] ✅ LLM CALL completed`);

      const aiMessage = completion.choices[0].message.parsed as InterviewStep | null;
      if (!aiMessage) throw new Error("Failed to parse AI response for interview step");

      console.log(`[UNIFIED_AGENT DEBUG] AI response - state: ${aiMessage.state}, message: ${aiMessage.assistant_message?.substring(0, 50)}...`);

      // Store assistant reply (assistant_message only)
      await addMessage(this.sessionId, "assistant", aiMessage.assistant_message);

      return aiMessage;
    }
  }