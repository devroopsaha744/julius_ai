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
      model: "moonshotai/kimi-k2-instruct-0905",
      messages: [
        { role: "system", content: this.prompt },
        { role: "user", content: "Generate exactly 3 coding problems: 1 easy, 1 medium, 1 hard. Return null for starter_template if none." }
      ],
      // Make the model output less deterministic so curated problems vary a bit.
      temperature: 0.8,
      top_p: 0.95,
      response_format: { type: "json_object" }
    });

    const raw = completion?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Failed to parse curator response: empty content");

    // The client may return the parsed JSON as an object or as a string. Handle both.
    let parsed: unknown;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch (err) {
        throw new Error(`Failed to JSON.parse curator content: ${(err as Error).message}`);
      }
    } else {
      parsed = raw;
    }

    const validation = CuratorOutputSchema.safeParse(parsed);
    if (!validation.success) {
      // Provide readable diagnostics for easier debugging in logs
      const issues = validation.error.format();
      throw new Error(`Curator output did not match schema: ${JSON.stringify(issues)}`);
    }

    // Cast to CuratorOutput to satisfy the declared return type and silence editor/type-checker
    return validation.data as CuratorOutput;
  }
}

export default new CodingCurator();
