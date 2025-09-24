"use client";

import React, { useEffect, useRef } from 'react';
import dynamic from 'next/dynamic';
import './CodeEditor.css';

const Editor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
});

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (code: string, language: string) => void;
  starterTemplates?: { java?: string; python?: string; cpp?: string } | string;
  language?: 'java' | 'python' | 'cpp';
  className?: string;
}

const DEFAULT_TEMPLATES = {
  java: `// Java starter\nimport java.io.*;\npublic class Main {\n    public static void main(String[] args) throws Exception {\n        BufferedReader br = new BufferedReader(new InputStreamReader(System.in));\n        String line = br.readLine();\n        System.out.println(line);\n    }\n}`,
  python: `# Python 3 starter\nimport sys\n\ndef solve(data):\n    print(data.strip())\n\nif __name__ == '__main__':\n    data = sys.stdin.read()\n    solve(data)`,
  cpp: `// C++ (17) starter\n#include <bits/stdc++.h>\nusing namespace std;\nint main() {\n    ios::sync_with_stdio(false);\n    cin.tie(nullptr);\n    string s;\n    getline(cin, s);\n    cout << s << '\\n';\n    return 0;\n}`,
};

export default function CodeEditor({ value, onChange, onSubmit, starterTemplates, language = 'java', className = '' }: CodeEditorProps) {
  const editorRef = useRef<any>(null);

  // Determine templates
  const templates = typeof starterTemplates === 'string'
    ? { java: starterTemplates, python: starterTemplates, cpp: starterTemplates }
    : { ...DEFAULT_TEMPLATES, ...(starterTemplates || {}) };

  // Initialize value if empty
  useEffect(() => {
    if (!value || value.trim() === '') {
      const t = templates[language] || DEFAULT_TEMPLATES[language as keyof typeof DEFAULT_TEMPLATES];
      onChange(t || '');
    }
  }, [language]);

  // Prevent copy/cut/context menu inside editor container
  useEffect(() => {
    function onCopy(e: ClipboardEvent) { e.preventDefault(); }
    function onCut(e: ClipboardEvent) { e.preventDefault(); }
    function onContext(e: MouseEvent) { e.preventDefault(); }
    window.addEventListener('copy', onCopy);
    window.addEventListener('cut', onCut);
    window.addEventListener('contextmenu', onContext);
    return () => {
      window.removeEventListener('copy', onCopy);
      window.removeEventListener('cut', onCut);
      window.removeEventListener('contextmenu', onContext);
    };
  }, []);

  const handleMount = (editor: any) => {
    editorRef.current = editor;
    editor.updateOptions({
      minimap: { enabled: false },
      readOnly: false,
      contextmenu: false,
      folding: false,
      lineNumbers: 'on',
    });
    // Ctrl+Enter to submit
    try {
      const monaco = require('monaco-editor');
      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
        onSubmit(value, language);
      });
    } catch {
      // ignore if monaco not available globally
    }
  };

  return (
    <div className={`code-editor-simple ${className}`} style={{ height: '100%', background: '#000' }}>
      <div style={{ height: '100%' }}>
        <Editor
          height="100%"
          language={language === 'cpp' ? 'cpp' : language}
          value={value}
          onChange={(v) => onChange(v || '')}
          onMount={handleMount}
          theme="vs-dark"
          options={{
            fontSize: 13,
            lineNumbers: 'on',
            minimap: { enabled: false },
            contextmenu: false,
            automaticLayout: true,
            readOnly: false,
          }}
        />
      </div>
    </div>
  );
}
