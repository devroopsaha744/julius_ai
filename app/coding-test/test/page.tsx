'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import CodeEditor from '../../components/CodeEditor';

interface Problem {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  input_format: string;
  output_format: string;
  constraints?: string | null;
  samples?: { input: string; output: string; explanation?: string | null }[];
  language: string;
  input_output_examples?: { input: string; output: string }[];
  test_cases: { input: string; expected_output: string }[];
  starter_template?: Record<string, string> | string | null;
}

export default function CodingTest() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId') || 'default';
  
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState(0);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState('java');
  const [codingTimeLeft, setCodingTimeLeft] = useState<number | null>(null);
  const [codingTimerActive, setCodingTimerActive] = useState(false);

  const getTemplate = (st: any, lang: string) => {
    if (!st) return '';
    if (typeof st === 'object' && !Array.isArray(st)) return st[lang] || '';
    if (typeof st === 'string') {
      try {
        const parsed = JSON.parse(st);
        return parsed[lang] || '';
      } catch {
        return st;
      }
    }
    return '';
  };

  useEffect(() => {
    fetchProblems();
  }, []);

  // Coding timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;

    if (codingTimerActive && codingTimeLeft !== null && codingTimeLeft > 0) {
      interval = setInterval(() => {
        setCodingTimeLeft(prev => {
          if (prev === null || prev <= 1) {
            // Timer expired - auto-submit
            handleAutoSubmit();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [codingTimerActive, codingTimeLeft]);

  const fetchProblems = async () => {
    try {
      const res = await fetch('/api/curate-coding');
      const data = await res.json();
      if (data.problems) {
        setProblems(data.problems);
        const firstProblem = data.problems[0];
        if (firstProblem) {
          setSelectedLanguage(firstProblem.language.toLowerCase());
          setCode(getTemplate(firstProblem.starter_template, firstProblem.language.toLowerCase()));
        }
        // Start 90-minute timer once problems are loaded
        setCodingTimeLeft(90 * 60); // 90 minutes in seconds
        setCodingTimerActive(true);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAutoSubmit = async () => {
    console.log('Auto-submitting coding solution due to timer expiration');
    setCodingTimerActive(false);

    // Auto-submit the current code
    if (code.trim()) {
      await submitCode();
    }

    // Show completion message
    setTimeout(() => {
      alert('Time is up! Your coding test has been submitted for evaluation. You can close this window.');
    }, 2000);
  };

  const submitCode = async () => {
    if (!problems[selectedProblem]) return;
    setSubmitting(true);
    setResult(null);
    try {
      const payload = {
        code,
        language: selectedLanguage,
        problem: problems[selectedProblem]
      };
      const res = await fetch('/api/evaluate-coding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.error) {
        setResult({ error: data.error });
      } else {
        setResult({ evaluation: data });
      }
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const runTests = async () => {
    if (!problems[selectedProblem]) return;
    setSubmitting(true);
    setResult(null);
    try {
      // Run each test case individually and aggregate
      const outputs: any[] = [];
      for (const tc of problems[selectedProblem].test_cases) {
        const payload = { source_code: code, language: selectedLanguage, stdin: tc.input };
        const res = await fetch('/api/onecompiler', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        const data = await res.json();
        outputs.push({ input: tc.input, expected: tc.expected_output, output: data.raw || data.result || data });
      }
      setResult({ run_outputs: outputs });
    } catch (e) {
      setResult({ error: String(e) });
    } finally {
      setSubmitting(false);
    }
  };

  const pollResult = async (token: string) => {
    const poll = async () => {
      try {
        const res = await fetch(`/api/judge0/result?token=${token}`);
        const data = await res.json();
        if (data.status?.id === 3) { // Accepted
          setResult(data);
        } else if (data.status?.id > 3) { // Finished with error
          setResult(data);
        } else {
          setTimeout(poll, 1000); // Poll again
        }
      } catch (e) {
        setResult({ error: String(e) });
      }
    };
    poll();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white text-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-xl">Curating coding problems...</p>
        </div>
      </div>
    );
  }

  const currentProblem = problems[selectedProblem];

  return (
    <div className="min-h-screen bg-white text-black overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 opacity-12">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-400/12 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/12 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 flex h-screen">
        {/* Problems Panel */}
        <div className="w-1/2 p-6 overflow-y-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold accent-text">Coding Test</h1>
            {codingTimerActive && codingTimeLeft !== null && (
              <div className={`px-4 py-2 rounded-lg text-lg font-mono font-bold ${
                codingTimeLeft < 600 ? 'bg-red-500 text-white' : 'bg-blue-500 text-white'
              }`}>
                {Math.floor(codingTimeLeft / 60)}:{(codingTimeLeft % 60).toString().padStart(2, '0')}
              </div>
            )}
          </div>
          <div className="space-y-4 mb-6">
            {problems.map((problem, index) => (
              <button
                key={problem.id}
                onClick={async () => {
                  setSelectedProblem(index);
                  setResult(null);
                  setSelectedLanguage(problem.language.toLowerCase());
                  try {
                    // Fetch the problem from cache-aware API to get consistent starter template
                    const res = await fetch(`/api/curate-coding/problem/${problem.id}`);
                    const d = await res.json();
                    if (d.problem && d.problem.starter_template) {
                      setCode(getTemplate(d.problem.starter_template, problem.language.toLowerCase()));
                    } else {
                      setCode(getTemplate(problem.starter_template, problem.language.toLowerCase()));
                    }
                  } catch (err) {
                    console.error('Failed to fetch cached problem', err);
                    setCode(getTemplate(problem.starter_template, problem.language.toLowerCase()));
                  }
                }}
                className={`w-full text-left p-4 rounded-lg border ${
                  selectedProblem === index ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
                }`}
              >
                <h3 className="font-bold">{problem.title}</h3>
                <p className="text-sm text-gray-600">Difficulty: {problem.difficulty} | Language: {problem.language}</p>
              </button>
            ))}
          </div>
          {currentProblem && (
            <div className="glass-surface rounded-2xl p-6">
              <h2 className="text-2xl font-bold mb-4 accent-text">{currentProblem.title}</h2>
              <p className="mb-4">{currentProblem.description}</p>
              <h3 className="font-bold mb-2">Input Format:</h3>
              <p className="mb-4">{currentProblem.input_format}</p>
              <h3 className="font-bold mb-2">Output Format:</h3>
              <p className="mb-4">{currentProblem.output_format}</p>
              <h3 className="font-bold mb-2">Constraints:</h3>
              <p className="mb-4">{currentProblem.constraints || 'None'}</p>
              <h3 className="font-bold mb-2">Test Cases:</h3>
              {currentProblem.test_cases.map((tc, i) => (
                <div key={i} className="mb-2">
                  <p><strong>Input:</strong> {tc.input}</p>
                  <p><strong>Expected Output:</strong> {tc.expected_output}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Code Editor Panel (minimal) */}
        <div className="w-1/2 p-6 flex flex-col">
          <h2 className="text-xl font-bold mb-4">Code Editor</h2>
          <div className="flex items-center space-x-2 mb-3">
            <label className="text-sm">Language:</label>
            <select
              value={selectedLanguage}
              onChange={(e) => {
                const lang = e.target.value;
                setSelectedLanguage(lang);
                if (currentProblem) {
                  setCode(getTemplate(currentProblem.starter_template, lang));
                }
              }}
              className="px-2 py-1 border rounded"
            >
              <option value="java">Java</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
            </select>
          </div>

          <div className="flex-1 mb-4" style={{ height: '60vh' }}>
            <CodeEditor
              value={code}
              onChange={setCode}
              onSubmit={(c, lang) => {
                setCode(c);
                submitCode();
              }}
              starterTemplates={currentProblem?.starter_template || {}}
              language={selectedLanguage as 'java' | 'python' | 'cpp'}
            />
          </div>
          <div className="flex space-x-3">
            <button
              onClick={runTests}
              disabled={submitting}
              className="btn-primary px-4 py-2 disabled:opacity-50"
            >
              {submitting ? 'Running...' : 'Run'}
            </button>

            <button
              onClick={submitCode}
              disabled={submitting}
              className="btn-electric px-6 py-3 disabled:opacity-50"
            >
              {submitting ? 'Submitting...' : 'Submit Code'}
            </button>
          </div>
          {result && (
            <div className="mt-4 p-4 glass-surface rounded-lg max-h-96 overflow-y-auto">
              {result.run_outputs && Array.isArray(result.run_outputs) ? (
                <div>
                  <h3 className="font-bold mb-4 text-xl">Run Results</h3>
                  <div className="space-y-4">
                    {(result.run_outputs as any[]).map((output: any, index: number) => {
                      const getOutputString = (out: any): string => {
                        if (typeof out === 'string') return out.trim();
                        if (out?.stdout) return String(out.stdout).trim();
                        if (out?.stderr) return String(out.stderr).trim();
                        return String(out || '').trim();
                      };
                      const actual = getOutputString(output.output);
                      const expected = String(output.expected || '').trim();
                      const passed = actual === expected;
                      return (
                        <div key={index} className="border rounded p-3">
                          <h4 className="font-semibold mb-2">Test Case {index + 1}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
                            <div>
                              <strong>Input:</strong>
                              <pre className="bg-gray-100 p-1 rounded mt-1">{output.input}</pre>
                            </div>
                            <div>
                              <strong>Expected:</strong>
                              <pre className="bg-gray-100 p-1 rounded mt-1">{output.expected}</pre>
                            </div>
                            <div>
                              <strong>Actual:</strong>
                              <pre className={`p-1 rounded mt-1 ${passed ? 'bg-green-100' : 'bg-red-100'}`}>
                                {getOutputString(output.output)}
                              </pre>
                            </div>
                          </div>
                          <div className="mt-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold ${passed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                              {passed ? 'PASS' : 'FAIL'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : result.evaluation ? (
                <div>
                  <h3 className="font-bold mb-4 text-xl">Evaluation Report</h3>
                  <div className="space-y-6">
                    {/* Scores */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="text-center p-4 bg-blue-50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-600">{(result.evaluation as any).correctness}/10</div>
                        <div className="text-sm text-gray-600">Correctness</div>
                      </div>
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <div className="text-2xl font-bold text-green-600">{(result.evaluation as any).optimization}/10</div>
                        <div className="text-sm text-gray-600">Optimization</div>
                      </div>
                      <div className="text-center p-4 bg-purple-50 rounded-lg">
                        <div className="text-2xl font-bold text-purple-600">{(result.evaluation as any).readability}/10</div>
                        <div className="text-sm text-gray-600">Readability</div>
                      </div>
                    </div>

                    {/* Complexity */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="p-4 bg-yellow-50 rounded-lg">
                        <div className="text-lg font-semibold text-yellow-800">Time: {(result.evaluation as any).time_complexity}</div>
                        <div className="text-sm text-gray-600">Time Complexity</div>
                      </div>
                      <div className="p-4 bg-orange-50 rounded-lg">
                        <div className="text-lg font-semibold text-orange-800">Space: {(result.evaluation as any).space_complexity}</div>
                        <div className="text-sm text-gray-600">Space Complexity</div>
                      </div>
                    </div>

                    {/* Strengths, Weaknesses, Suggestions */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-4 bg-green-50 rounded-lg">
                        <h4 className="font-semibold text-green-800 mb-2">Strengths</h4>
                        <ul className="text-sm space-y-1">
                          {(result.evaluation as any).strengths.map((s: string, i: number) => (
                            <li key={i} className="flex items-start">
                              <span className="text-green-600 mr-2">✓</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 bg-red-50 rounded-lg">
                        <h4 className="font-semibold text-red-800 mb-2">Weaknesses</h4>
                        <ul className="text-sm space-y-1">
                          {(result.evaluation as any).weaknesses.map((w: string, i: number) => (
                            <li key={i} className="flex items-start">
                              <span className="text-red-600 mr-2">✗</span>
                              {w}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="p-4 bg-blue-50 rounded-lg">
                        <h4 className="font-semibold text-blue-800 mb-2">Suggestions</h4>
                        <ul className="text-sm space-y-1">
                          {(result.evaluation as any).suggestions.map((s: string, i: number) => (
                            <li key={i} className="flex items-start">
                              <span className="text-blue-600 mr-2">💡</span>
                              {s}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    {/* Test Results */}
                    <div>
                      <h4 className="font-semibold mb-3">Test Case Results</h4>
                      <div className="space-y-2">
                        {(result.evaluation as any).test_results.map((tr: any, index: number) => (
                          <div key={index} className="flex items-center justify-between p-3 border rounded">
                            <div className="flex items-center space-x-3">
                              <span className={`px-2 py-1 rounded text-xs font-bold ${tr.passed ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                                {tr.passed ? 'PASS' : 'FAIL'}
                              </span>
                              <span className="text-sm">Test Case {index + 1}</span>
                              <span className="text-xs text-gray-500">({tr.execution_time}ms)</span>
                            </div>
                            {tr.exception && (
                              <span className="text-xs text-red-600">Error: {tr.exception}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Feedback */}
                    <div>
                      <h4 className="font-semibold mb-2">Detailed Feedback</h4>
                      <div className="bg-gray-50 p-4 rounded-lg">
                        <p className="text-sm whitespace-pre-wrap">{(result.evaluation as any).feedback}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (result as any).error ? (
                <div className="text-red-600">
                  <strong>Error:</strong> {(result as any).error}
                </div>
              ) : (
                <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}