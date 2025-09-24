'use client';

import { useState, useEffect } from 'react';
import CodeEditor from '../../components/CodeEditor';

interface Problem {
  id: string;
  title: string;
  difficulty: string;
  description: string;
  input_format: string;
  output_format: string;
  constraints?: string | null;
  samples: { input: string; output: string; explanation?: string | null }[];
  language: string;
  input_output_examples: { input: string; output: string }[];
  test_cases: { input: string; expected_output: string }[];
  starter_template?: string;
}

export default function CodingTest() {
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProblem, setSelectedProblem] = useState(0);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetchProblems();
  }, []);

  const fetchProblems = async () => {
    try {
      const res = await fetch('/api/curate-coding');
      const data = await res.json();
      if (data.problems) {
        setProblems(data.problems);
        if (data.problems[0]?.starter_template) {
          setCode(data.problems[0].starter_template);
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const submitCode = async () => {
    if (!problems[selectedProblem]) return;
    setSubmitting(true);
    setResult(null);
    try {
      const payload = {
        source_code: code,
        language: problems[selectedProblem].language,
        stdin: problems[selectedProblem].test_cases.map(tc => tc.input).join('\n')
      };
      const res = await fetch('/api/onecompiler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.token) {
        // Poll for result
        pollResult(data.token);
      } else {
        setResult({ error: 'Submission failed' });
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
        const payload = { source_code: code, language: problems[selectedProblem].language, stdin: tc.input };
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
          <h1 className="text-3xl font-bold mb-6 accent-text">Coding Test</h1>
          <div className="space-y-4 mb-6">
            {problems.map((problem, index) => (
              <button
                key={problem.id}
                onClick={async () => {
                  setSelectedProblem(index);
                  setResult(null);
                  try {
                    // Fetch the problem from cache-aware API to get consistent starter template
                    const res = await fetch(`/api/curate-coding/problem/${problem.id}`);
                    const d = await res.json();
                    if (d.problem && d.problem.starter_template) {
                      setCode(d.problem.starter_template);
                    } else {
                      setCode(problem.starter_template || '');
                    }
                  } catch (err) {
                    console.error('Failed to fetch cached problem', err);
                    setCode(problem.starter_template || '');
                  }
                }}
                className={`w-full text-left p-4 rounded-lg border ${
                  selectedProblem === index ? 'border-purple-500 bg-purple-50' : 'border-gray-300'
                }`}
              >
                <h3 className="font-bold">{problem.title}</h3>
                <p className="text-sm text-gray-600">Difficulty: {problem.difficulty}</p>
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
              <h3 className="font-bold mb-2">Samples:</h3>
              {currentProblem.samples.map((s, i) => (
                <div key={i} className="mb-3">
                  <p><strong>Input:</strong> {s.input}</p>
                  <p><strong>Output:</strong> {s.output}</p>
                  {s.explanation ? <p><strong>Explanation:</strong> {s.explanation}</p> : null}
                </div>
              ))}
              <h3 className="font-bold mb-2">Input/Output Examples:</h3>
              {currentProblem.input_output_examples.map((ex, i) => (
                <div key={i} className="mb-4">
                  <p><strong>Input:</strong> {ex.input}</p>
                  <p><strong>Output:</strong> {ex.output}</p>
                </div>
              ))}
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
              value={currentProblem?.language || 'java'}
              onChange={(e) => {
                const lang = e.target.value.toLowerCase();
                if (currentProblem) {
                  const st = currentProblem.starter_template;
                  let template = '';
                  if (!st) {
                    template = '';
                  } else if (typeof st === 'string') {
                    try {
                      const parsed = JSON.parse(st);
                      // try several key variants
                      template = parsed?.[lang] || parsed?.[lang === 'java' ? 'java' : lang] || '';
                    } catch {
                      // plain string
                      template = st;
                    }
                  } else {
                    // object
                    template = st[lang] || st[lang === 'java' ? 'java' : lang] || '';
                  }
                  setCode(template || '');
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
              starterTemplates={currentProblem?.starter_template}
              language={(currentProblem?.language as 'java' | 'python' | 'cpp') || 'java'}
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
            <div className="mt-4 p-4 glass-surface rounded-lg">
              <h3 className="font-bold mb-2">Result:</h3>
              <pre className="text-sm">{JSON.stringify(result, null, 2)}</pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}