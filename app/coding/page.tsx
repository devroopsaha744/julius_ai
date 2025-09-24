"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";

const MonacoEditor = dynamic(() => import("@monaco-editor/react"), { ssr: false });

export default function CodingPage() {
  const [code, setCode] = useState<string>(`// Write your solution here\nfunction solve(input) {\n  return input;\n}`);
  const [language, setLanguage] = useState<string>("javascript");
  const [stdin, setStdin] = useState<string>("");
  const [output, setOutput] = useState<string>("");
  const [running, setRunning] = useState(false);

  async function runSubmission() {
    setRunning(true);
    setOutput("Running...");
    try {
      const res = await fetch('/api/onecompiler', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_code: code, language: language, stdin })
      });
      const json = await res.json();
      setOutput(JSON.stringify(json, null, 2));
    } catch (e) {
      setOutput(String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="min-h-screen p-8 bg-surface">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Recruiter Coding Interface</h1>
            <p className="muted">A clean editor to run candidate code and integrate with Judge0</p>
          </div>
          <div className="editor-actions">
            <select value={language} onChange={e => setLanguage(e.target.value)} className="px-3 py-2 border rounded">
              <option value="javascript">JavaScript</option>
              <option value="python">Python</option>
              <option value="cpp">C++</option>
            </select>
            <button className="btn-primary" onClick={runSubmission} disabled={running}>Run</button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="code-editor-shell">
              <MonacoEditor height="60vh" defaultLanguage={language} value={code} onChange={(v) => setCode(v || "")} theme="vs-dark" />
            </div>
          </div>

          <div>
            <div className="glass-surface p-4 mb-4">
              <h4 className="font-semibold mb-2">Input (stdin)</h4>
              <textarea className="w-full p-2 border rounded" rows={6} value={stdin} onChange={e => setStdin(e.target.value)} />
            </div>

            <div className="glass-surface p-4">
              <h4 className="font-semibold mb-2">Output</h4>
              <pre className="whitespace-pre-wrap text-sm bg-black/90 text-white p-3 rounded">{output}</pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
