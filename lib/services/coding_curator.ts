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
import { MongoClient } from "mongodb";

class CodingCurator {
   private prompt: string = "";

  constructor() {
    // Prompt will be loaded lazily
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

      if (config?.prompts?.coding) {
        await client.close();
        this.prompt = config.prompts.coding;
        return this.prompt;
      }

      await client.close();
    } catch (error) {
      console.error('Failed to load custom coding prompt, using default:', error);
    }

    // Fall back to default prompt
    const promptPath = path.join(process.cwd(), "lib", "prompts", "coding_curator.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");
    return this.prompt;
  }

  async curate(): Promise<CuratorOutput> {
    const prompt = await this.getPrompt();

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

    const completion = await groqClient.chat.completions.create({
      model: "moonshotai/kimi-k2-instruct-0905",
      messages: [
        { role: "system", content: prompt },
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
