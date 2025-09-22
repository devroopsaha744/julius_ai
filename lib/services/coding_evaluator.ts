/**
 * Coding Evaluator Agent
 * Uses Judge0 for code execution and test case validation, then Groq for additional evaluation.
 * Output schema matches EvaluatorOutput.
 */

import { groqClient } from "../utils/groqclient";
import { EvaluatorOutputSchema, EvaluatorOutput, CuratorOutput } from "../models/models";
import { zodResponseFormat } from "openai/helpers/zod";
import fs from "fs";
import path from "path";
import { Judge0Executor } from "./judge0_executor";
import { z } from "zod";

export type SubmissionFile = { path: string; content: string };
export type Submission = { id: string; language: string; files: SubmissionFile[] };
export type EvaluatorInput = { submissions: Submission[]; problems: CuratorOutput };

class CodingEvaluator {
  private prompt: string;
  private judge0Executor: Judge0Executor;

  constructor() {
    const promptPath = path.join(process.cwd(), "lib", "prompts", "coding_evaluator.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");

    // Initialize Judge0 executor
    const judge0Host = process.env.JUDGE0_RAPIDAPI_HOST || 'judge0-ce.p.rapidapi.com';
    const judge0ApiKey = process.env.JUDGE0_RAPIDAPI_KEY;
    this.judge0Executor = new Judge0Executor(`https://${judge0Host}`, judge0ApiKey);
  }

  async evaluate(input: EvaluatorInput): Promise<EvaluatorOutput> {
    const { submissions, problems } = input;

    console.log(`[CODING_EVALUATOR] Evaluating ${submissions.length} submissions against ${problems.problems.length} problems`);

    const results: EvaluatorOutput['results'] = [];

    for (const submission of submissions) {
      console.log(`[CODING_EVALUATOR] Processing submission ${submission.id}`);

      // Find the corresponding problem
      const problem = problems.problems.find(p => p.id === submission.id);
      if (!problem) {
        console.warn(`[CODING_EVALUATOR] No problem found for submission ${submission.id}`);
        continue;
      }

      // Combine all files into a single source code (assuming main file is the solution)
      const sourceCode = this.combineSubmissionFiles(submission.files);

      try {
        // Execute code against test cases using Judge0
        const executionResult = await this.judge0Executor.executeCode(
          sourceCode,
          problem.language || 'javascript',
          problem.test_cases
        );

        // Use Groq for additional evaluation (readability, optimization feedback)
        const groqEvaluation = await this.evaluateWithGroq(submission, problem, executionResult);

        results.push({
          id: submission.id,
          correctness: Math.round((executionResult.passed_tests / executionResult.total_tests) * 10),
          optimization: groqEvaluation.optimization,
          readability: groqEvaluation.readability,
          feedback: groqEvaluation.feedback,
          passed_tests: executionResult.passed_tests,
          total_tests: executionResult.total_tests
        });

        console.log(`[CODING_EVALUATOR] Submission ${submission.id}: ${executionResult.passed_tests}/${executionResult.total_tests} tests passed`);

      } catch (error) {
        console.error(`[CODING_EVALUATOR] Error evaluating submission ${submission.id}:`, error);

        // Fallback evaluation without execution
        const fallbackEvaluation = await this.evaluateWithGroq(submission, problem);

        results.push({
          id: submission.id,
          correctness: 1, // Failed execution
          optimization: fallbackEvaluation.optimization,
          readability: fallbackEvaluation.readability,
          feedback: `Code execution failed: ${error instanceof Error ? error.message : 'Unknown error'}. ${fallbackEvaluation.feedback}`,
          passed_tests: 0,
          total_tests: problem.test_cases.length
        });
      }
    }

    // Calculate overall evaluation
    const overallCorrectness = results.reduce((sum, r) => sum + r.correctness, 0) / results.length;
    const overallOptimization = results.reduce((sum, r) => sum + r.optimization, 0) / results.length;
    const overallReadability = results.reduce((sum, r) => sum + r.readability, 0) / results.length;

    const overallRecommendation = this.determineRecommendation(overallCorrectness, overallOptimization, overallReadability);

    return {
      results,
      overall: {
        overall_correctness: Math.round(overallCorrectness),
        overall_optimization: Math.round(overallOptimization),
        overall_readability: Math.round(overallReadability),
        recommendation: overallRecommendation
      }
    };
  }

  private combineSubmissionFiles(files: SubmissionFile[]): string {
    // Assume the main solution file is the one without path separators or find by common patterns
    const mainFile = files.find(f =>
      f.path.includes('solution') ||
      f.path.includes('main') ||
      f.path.endsWith('.js') ||
      f.path.endsWith('.py') ||
      f.path.endsWith('.java')
    ) || files[0];

    return mainFile.content;
  }

  private async evaluateWithGroq(
    submission: Submission,
    problem: any,
    executionResult?: any
  ): Promise<{ optimization: number; readability: number; feedback: string }> {
    const sourceCode = this.combineSubmissionFiles(submission.files);

    const evaluationPrompt = `
Please evaluate the following code submission for a coding problem:

**PROBLEM:**
${problem.title}
${problem.description}

**CODE SUBMISSION:**
\`\`\`
${sourceCode}
\`\`\`

${executionResult ? `**EXECUTION RESULTS:**
- Tests passed: ${executionResult.passed_tests}/${executionResult.total_tests}
- Average execution time: ${executionResult.average_time.toFixed(3)}s
- Average memory usage: ${executionResult.average_memory}KB
` : '**EXECUTION FAILED**'}

Please provide:
1. Optimization score (1-10): How efficient is the solution?
2. Readability score (1-10): How clean and readable is the code?
3. Detailed feedback: Specific suggestions for improvement

Respond in JSON format:
{
  "optimization": number,
  "readability": number,
  "feedback": "string"
}
`;

    try {
      const completion = await groqClient.chat.completions.parse({
        model: "openai/gpt-oss-120b",
        messages: [{ role: "system", content: evaluationPrompt }],
        response_format: zodResponseFormat(
          z.object({
            optimization: z.number().min(1).max(10),
            readability: z.number().min(1).max(10),
            feedback: z.string()
          }),
          "evaluation"
        )
      });

      const result = completion.choices[0].message.parsed;
      return result as { optimization: number; readability: number; feedback: string };

    } catch (error) {
      console.error('[CODING_EVALUATOR] Groq evaluation failed:', error);
      return {
        optimization: 5,
        readability: 5,
        feedback: 'Automated evaluation failed. Manual review recommended.'
      };
    }
  }

  private determineRecommendation(correctness: number, optimization: number, readability: number): 'pass' | 'fail' | 'manual_review' {
    const averageScore = (correctness + optimization + readability) / 3;

    if (correctness >= 8 && averageScore >= 7) {
      return 'pass';
    } else if (correctness < 5 || averageScore < 4) {
      return 'fail';
    } else {
      return 'manual_review';
    }
  }
}

export default new CodingEvaluator();
