/**
 * Coding Curator Agent
 * Uses Groq to generate exactly 3 coding problems in structured JSON.
 * Output schema matches CuratorOutput.
 */

import { groqClient } from "../utils/groqclient";
import { CuratorOutputSchema, CuratorOutput } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";

class CodingCurator {
  private prompt: string;

  constructor() {
    const promptPath = path.join(process.cwd(), "lib", "prompts", "coding_curator.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");
  }

  async curate(): Promise<CuratorOutput> {
    const completion = await groqClient.chat.completions.parse({
      model: "openai/gpt-oss-120b",
      messages: [{ role: "system", content: this.prompt }],
      response_format: zodResponseFormat(CuratorOutputSchema, "curator_output")
    });

    const result = completion.choices[0].message.parsed as CuratorOutput | null;
    if (!result) throw new Error("Failed to parse curator response");

    return result;
  }
}

export default new CodingCurator();
