export interface Judge0Submission {
  source_code: string;
  language_id: number;
  stdin: string;
  expected_output?: string;
  cpu_time_limit?: number;
  memory_limit?: number;
}

export interface Judge0Result {
  stdout: string;
  stderr: string;
  compile_output: string;
  message: string;
  exit_code: number;
  exit_signal: number;
  status: {
    id: number;
    description: string;
  };
  time: string;
  memory: number;
  token: string;
}

export interface TestCaseResult {
  input: string;
  expected_output: string;
  actual_output: string;
  passed: boolean;
  execution_time: number;
  memory_used: number;
  error?: string;
}

export interface ExecutionResult {
  problem_id: string;
  overall_passed: boolean;
  test_results: TestCaseResult[];
  total_tests: number;
  passed_tests: number;
  average_time: number;
  average_memory: number;
}

export class Judge0Executor {
  private baseUrl: string;
  private apiKey?: string;

  constructor(baseUrl: string = 'https://judge0-ce.p.rapidapi.com', apiKey?: string) {
    this.baseUrl = baseUrl;
    this.apiKey = apiKey;
  }

  // Language ID mapping for Judge0
  private getLanguageId(language: string): number {
    const languageMap: { [key: string]: number } = {
      'javascript': 63, // Node.js
      'python': 71,
      'java': 62,
      'cpp': 54,
      'c': 50,
      'csharp': 51,
      'php': 68,
      'ruby': 72,
      'swift': 83,
      'go': 60,
      'kotlin': 78,
      'scala': 81,
      'rust': 73,
      'typescript': 74,
      'r': 80,
      'perl': 85,
      'haskell': 61,
      'clojure': 86,
      'erlang': 58,
      'elixir': 57,
      'dart': 84
    };
    return languageMap[language.toLowerCase()] || 63; // Default to JavaScript
  }

  async executeCode(
    sourceCode: string,
    language: string,
    testCases: Array<{ input: string; expected_output: string }>
  ): Promise<ExecutionResult> {
    const languageId = this.getLanguageId(language);
    const testResults: TestCaseResult[] = [];
    let passedTests = 0;

    console.log(`[JUDGE0] Executing ${testCases.length} test cases for ${language} code`);

    for (const testCase of testCases) {
      try {
        const result = await this.submitAndWait(sourceCode, languageId, testCase.input);
        const passed = this.compareOutputs(result.stdout?.trim(), testCase.expected_output?.trim());

        const testResult: TestCaseResult = {
          input: testCase.input,
          expected_output: testCase.expected_output,
          actual_output: result.stdout || '',
          passed,
          execution_time: parseFloat(result.time) || 0,
          memory_used: result.memory || 0,
          error: result.stderr || result.compile_output || result.message
        };

        testResults.push(testResult);
        if (passed) passedTests++;

        console.log(`[JUDGE0] Test case ${testResults.length}: ${passed ? 'PASS' : 'FAIL'}`);

      } catch (error) {
        console.error(`[JUDGE0] Error executing test case:`, error);
        testResults.push({
          input: testCase.input,
          expected_output: testCase.expected_output,
          actual_output: '',
          passed: false,
          execution_time: 0,
          memory_used: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    const averageTime = testResults.reduce((sum, r) => sum + r.execution_time, 0) / testResults.length;
    const averageMemory = testResults.reduce((sum, r) => sum + r.memory_used, 0) / testResults.length;

    return {
      problem_id: '', // Will be set by caller
      overall_passed: passedTests === testCases.length,
      test_results: testResults,
      total_tests: testCases.length,
      passed_tests: passedTests,
      average_time: averageTime,
      average_memory: averageMemory
    };
  }

  private async submitAndWait(sourceCode: string, languageId: number, stdin: string): Promise<Judge0Result> {
    const submission: Judge0Submission = {
      source_code: sourceCode,
      language_id: languageId,
      stdin: stdin,
      cpu_time_limit: 5, // 5 seconds
      memory_limit: 256000 // 256 MB
    };

    const headers: any = {
      'Content-Type': 'application/json'
    };

    if (this.apiKey) {
      headers['X-RapidAPI-Key'] = this.apiKey;
      headers['X-RapidAPI-Host'] = 'judge0-ce.p.rapidapi.com';
    }

    // Submit code
    const submitResponse = await fetch(`${this.baseUrl}/submissions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(submission)
    });

    if (!submitResponse.ok) {
      throw new Error(`Judge0 submission failed: ${submitResponse.statusText}`);
    }

    const submitData = await submitResponse.json();
    const token = submitData.token;

    if (!token) {
      throw new Error('No token received from Judge0 submission');
    }

    // Wait for result
    let attempts = 0;
    const maxAttempts = 30; // 30 seconds max

    while (attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second

      const resultResponse = await fetch(`${this.baseUrl}/submissions/${token}`, {
        method: 'GET',
        headers
      });

      if (!resultResponse.ok) {
        throw new Error(`Judge0 result fetch failed: ${resultResponse.statusText}`);
      }

      const result: Judge0Result = await resultResponse.json();

      if (result.status.id > 2) { // Status > 2 means finished (1=pending, 2=processing)
        return result;
      }

      attempts++;
    }

    throw new Error('Code execution timed out');
  }

  private compareOutputs(actual: string, expected: string): boolean {
    if (!actual && !expected) return true;
    if (!actual || !expected) return false;

    // Normalize line endings and trim
    const normalize = (str: string) => str.replace(/\r\n/g, '\n').replace(/\r/g, '\n').trim();

    return normalize(actual) === normalize(expected);
  }

  async executeProblemSet(
    problems: Array<{
      id: string;
      language: string;
      test_cases: Array<{ input: string; expected_output: string }>;
    }>,
    userCode: string
  ): Promise<ExecutionResult[]> {
    const results: ExecutionResult[] = [];

    for (const problem of problems) {
      console.log(`[JUDGE0] Executing problem ${problem.id}`);
      const result = await this.executeCode(userCode, problem.language, problem.test_cases);
      result.problem_id = problem.id;
      results.push(result);
    }

    return results;
  }
}