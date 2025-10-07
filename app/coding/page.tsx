"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Play } from "lucide-react";

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
          <div className="flex items-center space-x-4">
            <Select value={language} onValueChange={setLanguage}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="javascript">JavaScript</SelectItem>
                <SelectItem value="python">Python</SelectItem>
                <SelectItem value="cpp">C++</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={runSubmission} disabled={running}>
              <Play className="w-4 h-4 mr-2" />
              {running ? 'Running...' : 'Run'}
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="code-editor-shell">
              <MonacoEditor height="60vh" defaultLanguage={language} value={code} onChange={(v) => setCode(v || "")} theme="vs-dark" />
            </div>
          </div>

          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Input (stdin)</CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  rows={6}
                  value={stdin}
                  onChange={(e) => setStdin(e.target.value)}
                  placeholder="Enter input for your code..."
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Output</CardTitle>
              </CardHeader>
              <CardContent>
                <pre className="whitespace-pre-wrap text-sm bg-black/90 text-white p-3 rounded min-h-32">{output}</pre>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
