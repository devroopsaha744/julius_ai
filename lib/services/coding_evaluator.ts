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
import { runOnOneCompiler } from "./onecompiler_executor";
import { z } from "zod";

export type SubmissionFile = { path: string; content: string };
export type Submission = { id: string; language: string; files: SubmissionFile[] };
export type EvaluatorInput = { submissions: Submission[]; problems: CuratorOutput };

export type SingleEvaluatorInput = { code: string; language: string; problem: any };
export type SingleEvaluatorOutput = {
  correctness: number;
  optimization: number;
  readability: number;
  feedback: string;
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  time_complexity: string;
  space_complexity: string;
  test_results: Array<{
    test_case_index: number;
    passed: boolean;
    actual_output: string;
    expected_output: string;
    execution_time: number;
    stderr?: string | null;
    exception?: string | null;
  }>;
};

class CodingEvaluator {
  private prompt: string;
  // executor removed; use runOnOneCompiler helper

  constructor() {
    const promptPath = path.join(process.cwd(), "lib", "prompts", "coding_evaluator.txt");
    this.prompt = fs.readFileSync(promptPath, "utf-8");

  // No executor instance required; we call runOnOneCompiler directly per test case
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
        // Execute code against test cases using OneCompiler (call API per test case)
        const testResults = [] as Array<{ passed: boolean; actual: string; execution_time: number; stderr?: string | null; exception?: string | null }>;
        for (const tc of problem.test_cases) {
          try {
            const resp = await runOnOneCompiler({ language: problem.language || 'javascript', stdin: tc.input, source_code: sourceCode });
            const out = (resp.stdout || '') as string;
            const passed = out.trim() === (tc.expected_output || '').trim();
            testResults.push({ passed, actual: out, execution_time: resp.executionTime || 0, stderr: resp.stderr || null, exception: resp.exception || null });
          } catch (err) {
            testResults.push({ passed: false, actual: '', execution_time: 0, stderr: null, exception: err instanceof Error ? err.message : String(err) });
          }
        }

        const passed_tests = testResults.filter(t => t.passed).length;
        const total_tests = testResults.length;
        const average_time = testResults.reduce((s, r) => s + (r.execution_time || 0), 0) / (total_tests || 1);

        const executionResult = {
          passed_tests,
          total_tests,
          average_time,
          average_memory: 0,
          test_results: testResults
        } as any;

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

  async evaluateSingle(input: SingleEvaluatorInput): Promise<SingleEvaluatorOutput> {
    const { code, language, problem } = input;

    console.log(`[CODING_EVALUATOR] Evaluating single submission for problem ${problem.id}`);

    const testResults: SingleEvaluatorOutput['test_results'] = [];

    for (let i = 0; i < problem.test_cases.length; i++) {
      const tc = problem.test_cases[i];
      try {
        const resp = await runOnOneCompiler({ language, stdin: tc.input, source_code: code });
        const actual = (resp.stdout || '') as string;
        const passed = actual.trim() === tc.expected_output.trim();
        testResults.push({
          test_case_index: i,
          passed,
          actual_output: actual,
          expected_output: tc.expected_output,
          execution_time: resp.executionTime || 0,
          stderr: resp.stderr || null,
          exception: resp.exception || null
        });
      } catch (err) {
        testResults.push({
          test_case_index: i,
          passed: false,
          actual_output: '',
          expected_output: tc.expected_output,
          execution_time: 0,
          stderr: null,
          exception: err instanceof Error ? err.message : String(err)
        });
      }
    }

    // Use Groq for evaluation
    const groqEvaluation = await this.evaluateSingleWithGroq(code, language, problem, testResults);

    return {
      correctness: groqEvaluation.correctness,
      optimization: groqEvaluation.optimization,
      readability: groqEvaluation.readability,
      feedback: groqEvaluation.feedback,
      strengths: groqEvaluation.strengths,
      weaknesses: groqEvaluation.weaknesses,
      suggestions: groqEvaluation.suggestions,
      time_complexity: groqEvaluation.time_complexity,
      space_complexity: groqEvaluation.space_complexity,
      test_results: testResults
    };
  }

  private async evaluateSingleWithGroq(
    code: string,
    language: string,
    problem: any,
    testResults: SingleEvaluatorOutput['test_results']
  ): Promise<{ correctness: number; optimization: number; readability: number; feedback: string; strengths: string[]; weaknesses: string[]; suggestions: string[]; time_complexity: string; space_complexity: string }> {
    const passedCount = testResults.filter(tr => tr.passed).length;
    const totalCount = testResults.length;
    const avgTime = testResults.reduce((sum, tr) => sum + tr.execution_time, 0) / totalCount;

    const testDetails = testResults.map((tr, i) => {
      const status = tr.passed ? 'PASS' : 'FAIL';
      const time = tr.execution_time > 0 ? ` (${tr.execution_time}ms)` : '';
      const error = tr.exception ? ` Error: ${tr.exception}` : '';
      return `Test ${i + 1}: ${status}${time}${error}`;
    }).join('\n');

    const failedTests = testResults.filter(tr => !tr.passed);
    const failureAnalysis = failedTests.length > 0 ?
      `\nFailed Test Analysis:\n${failedTests.map((tr, i) =>
        `Test ${testResults.indexOf(tr) + 1}: Expected "${tr.expected_output}", Got "${tr.actual_output}"`
      ).join('\n')}` : '';

    const evaluationPrompt = `
You are an expert senior software engineer evaluating a coding submission.

**PROBLEM STATEMENT:**
Title: ${problem.title}
Description: ${problem.description}
Constraints: ${problem.constraints || 'None specified'}

**CODE SUBMISSION (${language}):**
\`\`\`${language}
${code}
\`\`\`

**EXECUTION RESULTS:**
- Tests Passed: ${passedCount}/${totalCount} (${Math.round((passedCount/totalCount)*100)}%)
- Average Execution Time: ${avgTime.toFixed(2)}ms
- Test Details:
${testDetails}${failureAnalysis}

**COMPREHENSIVE EVALUATION REQUIRED:**

Analyze the code across these dimensions:

1. **CORRECTNESS (1-10)**: Functional accuracy, edge cases, error handling, logic soundness
2. **OPTIMIZATION (1-10)**: Time/space complexity, algorithm choice, performance, scalability
3. **READABILITY (1-10)**: Code structure, naming, documentation, style, maintainability

**Provide detailed feedback covering:**
- Strengths of the solution
- Specific weaknesses with examples
- Algorithm/approach analysis
- Code quality assessment
- Concrete improvement suggestions
- Learning takeaways

**Scoring Guidelines:**
- 9-10: Exceptional (production-ready)
- 7-8: Good (solid with minor issues)
- 5-6: Adequate (works but needs refinement)
- 3-4: Poor (major issues)
- 1-2: Unacceptable

Return ONLY JSON:
{
  "correctness": number,
  "optimization": number,
  "readability": number,
  "feedback": "Detailed 200-400 word analysis with specific examples and actionable suggestions"
}
`;

    try {
      const completion = await groqClient.chat.completions.parse({
        model: "moonshotai/kimi-k2-instruct-0905",
        messages: [{ role: "system", content: this.prompt }, { role: "user", content: evaluationPrompt }],
        temperature: 0.3,
        response_format: zodResponseFormat(
          z.object({
            correctness: z.number().min(1).max(10),
            optimization: z.number().min(1).max(10),
            readability: z.number().min(1).max(10),
            feedback: z.string(),
            strengths: z.array(z.string()),
            weaknesses: z.array(z.string()),
            suggestions: z.array(z.string()),
            time_complexity: z.string(),
            space_complexity: z.string()
          }),
          "evaluation"
        )
      });

      const result = completion.choices[0].message.parsed;
      return result as { correctness: number; optimization: number; readability: number; feedback: string; strengths: string[]; weaknesses: string[]; suggestions: string[]; time_complexity: string; space_complexity: string };

    } catch (error) {
      console.error('[CODING_EVALUATOR] Groq evaluation failed:', error);
      return {
        correctness: Math.round((passedCount / totalCount) * 10),
        optimization: 5,
        readability: 5,
        feedback: `Evaluation completed with ${passedCount}/${totalCount} tests passing. Average execution time: ${avgTime.toFixed(2)}ms. ${failedTests.length > 0 ? `Failed tests indicate areas for improvement. ` : ''}Manual review recommended for detailed feedback.`,
        strengths: [`Passed ${passedCount}/${totalCount} test cases`],
        weaknesses: failedTests.length > 0 ? ['Some test cases failed'] : [],
        suggestions: ['Review failed test cases', 'Consider edge cases'],
        time_complexity: 'Unknown',
        space_complexity: 'Unknown'
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
