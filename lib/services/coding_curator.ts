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
    const tags = [
      "array", "string", "dynamic-programming", "binary-tree", "graph",
      "linked-list", "backtracking", "greedy", "binary-search", "heap",
      "hash-table", "stack", "queue", "recursion", "sliding-window",
      "two-pointer", "bit-manipulation", "math", "design", "simulation"
    ];

    const difficulties = ["EASY", "MEDIUM", "HARD"];

    // Create 3 dynamic combos with random difficulties
    const shuffledDifficulties = [...difficulties].sort(() => 0.5 - Math.random());
    const combos = [];
    for (let i = 0; i < 3; i++) {
      const numTags = Math.floor(Math.random() * 3) + 1; // 1-3 tags
      const shuffledTags = [...tags].sort(() => 0.5 - Math.random());
      const selectedTags = shuffledTags.slice(0, numTags);
      combos.push({
        tags: selectedTags,
        difficulty: shuffledDifficulties[i]
      });
    }

    const userContent = `Generate exactly 3 coding problems based on these combinations: ${JSON.stringify(combos)}. Return null for starter_template if none.`;

    const completion = await groqClient.chat.completions.parse({
      model: "moonshotai/kimi-k2-instruct-0905",
      messages: [
        { role: "system", content: this.prompt },
        { role: "user", content: userContent }
      ],
      temperature: 0.9,
      response_format: { type: "json_object" }
    });

    const raw = completion?.choices?.[0]?.message?.content;
    if (!raw) throw new Error("Failed to parse curator response: empty content");

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
      const issues = validation.error.format();
      throw new Error(`Curator output did not match schema: ${JSON.stringify(issues)}`);
    }

    return validation.data as CuratorOutput;
  }
}

export default new CodingCurator();
