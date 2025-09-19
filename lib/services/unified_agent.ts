import { groqClient } from "../utils/groqclient";
import { InterviewStepSchema, InterviewStep } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import { ChatCompletionMessageParam } from "openai/resources";
import fs from "fs";
import path from "path";
import { addMessage, getMessages } from "../utils/redisSession";

export class UnifiedInterviewAgent {
  private prompt: string;
  private fewshotExamples: any;
  private sessionId: string;

  constructor(sessionId: string) {
    this.sessionId = sessionId;
    const promptPath = path.join(process.cwd(), "lib", "prompts", "unified_interview.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");
    
    // Load fewshot examples
    const examplesPath = path.join(process.cwd(), "lib", "prompts", "fewshot_examples.json");
    this.fewshotExamples = JSON.parse(fs.readFileSync(examplesPath, "utf-8"));
  }

  /**
   * Run the unified agent.
   * @param userMessage - incoming user message
   * @param userCode - optional code (only passed when in coding stage)
   * @param currentSubstate - one of 'greet','resume','coding','cs','behave','wrap_up','end'
   * @param resumeContent - optional plain-text resume content to include in context
   */
  async run(userMessage: string, userCode?: string, currentSubstate: string = "greet", resumeContent?: string, codeSubmitted: boolean = false) {
    // Store the user's message. Format appropriately for coding stage.
    let messageContent: string;
    if (currentSubstate === "coding" && codeSubmitted && userCode) {
      messageContent = `<transcripts>\n${userMessage}\n</transcripts>\n\n<code>\n${userCode}\n</code>`;
    } else {
      messageContent = userMessage;
    }
    await addMessage(this.sessionId, "user", messageContent);

    // Get conversation history
    const history = await getMessages(this.sessionId);

    // Get relevant fewshot examples for current substate
    const relevantExamples = this.fewshotExamples.fewshot_examples.find(
      (example: any) => example.stage === currentSubstate
    );


  // Build enhanced prompt with current state, examples, and explicit system instructions
  // NOTE: We keep full conversation history available, but strongly instruct the model to focus
  // only on the provided `currentSubstate` for question selection. This avoids trimming history
  // but prevents the model from continuing previous-stage follow-ups.
  let enhancedPrompt = `${this.prompt}

**CURRENT SUBSTATE:** ${currentSubstate}

**CANDIDATE RESUME (if provided):**
${resumeContent || 'N/A'}

**CONVERSATION HISTORY (full):**
${history.map(m => `${m.role}: ${m.content}`).join('\n')}

  **IMPORTANT INSTRUCTIONS (READ CAREFULLY):**
1. You have access to the full conversation history above for context, but for the next response you MUST ONLY ask questions or provide content that is relevant to the CURRENT SUBSTATE: "${currentSubstate}".
2. Under NO CIRCUMSTANCE should you resurrect or continue follow-ups that belong to previous substates (for example: asking resume clarification questions during coding), unless the candidate explicitly brings the previous topic back up in their message.
3. If the stage has just changed, immediately shift your focus to the new stage and begin with stage-appropriate questions. Do not continue the previous stage's question flow.
4. When in the 'coding' substate: accept pseudo-code and spoken explanations. Focus on problem understanding first, then ask for clarifying requirements or small code snippets. Provide progressive hints (high-level -> next step -> focused hint) and do NOT attach any code unless 'codeSubmitted' is true.
5. When in the 'cs' or 'behavioral' substates: if the candidate asks for help or hints, provide progressive hints — start with a high-level approach, then a small next step, then a focused hint; never give a full solution unless explicitly requested.
6. Always return a valid JSON object conforming to the InterviewStep schema, and set the 'substate' field to one of the allowed values: 'greet', 'resume', 'coding', 'cs', 'behave', 'wrap_up', or 'end'. Do not use any other tokens.
7. Keep assistant messages concise and actionable. Use the fewshot example below as a style guide.

`;

    // Add fewshot examples if available
    if (relevantExamples) {
      enhancedPrompt += `

**FEWSHOT EXAMPLE FOR ${currentSubstate.toUpperCase()} STAGE:**
${relevantExamples.conversation.map((msg: any) => 
  `${msg.role === 'assistant' ? 'Julius' : 'Candidate'}: ${msg.message}`
).join('\n')}

**USE THIS EXAMPLE AS A TEMPLATE FOR YOUR RESPONSE STYLE AND QUESTION FLOW**`;
    }

    // No automatic 'ready_to_move' token — stage changes must be communicated by returning one of the allowed substate tokens.

    // Build the message array for the model
    // Add a short system message (enhancedPrompt) and then the full conversation history
    const messages: ChatCompletionMessageParam[] = [
      { role: "system", content: enhancedPrompt },
      ...history.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content
      }))
    ];

    // Model call
    const completion = await groqClient.chat.completions.parse({
      model: "openai/gpt-oss-120b",
      messages,
      response_format: zodResponseFormat(InterviewStepSchema, "interview_step")
    });

    const aiMessage = completion.choices[0].message.parsed;
    if (!aiMessage) {
      throw new Error("Failed to parse AI response");
    }

    // Store AI's reply
    await addMessage(this.sessionId, "assistant", aiMessage.assistant_message);

    return aiMessage;
  }
}