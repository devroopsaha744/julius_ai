import { groqClient } from "./groqclient";
import { InterviewStepSchema } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";

export class GreetingAgent {
  private prompt: string;

  constructor() {
    const promptPath = path.join(process.cwd(), "lib", "prompts", "greet.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");
  }

  async run(userMessage: string) {
    const completion = await groqClient.chat.completions.parse({
      model: "gpt-4o-2024-08-06",
      messages: [
        { role: "system", content: this.prompt },
        { role: "user", content: userMessage }
      ],
      response_format: zodResponseFormat(InterviewStepSchema, "interview_step")
    });

    return completion.choices[0].message.parsed;
  }
}
