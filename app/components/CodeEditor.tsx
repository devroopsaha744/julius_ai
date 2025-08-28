'use client';

import React, { useState, useRef, useEffect } from 'react';
import './CodeEditor.css';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (code: string, language: string, explanation: string) => void;
  onKeystroke?: (code: string, language: string) => void;
  disabled?: boolean;
  className?: string;
}

const LANGUAGES = [
  { id: 'javascript', name: 'JavaScript', ext: '.js' },
  { id: 'python', name: 'Python', ext: '.py' },
  { id: 'java', name: 'Java', ext: '.java' },
  { id: 'cpp', name: 'C++', ext: '.cpp' },
  { id: 'c', name: 'C', ext: '.c' },
  { id: 'csharp', name: 'C#', ext: '.cs' },
  { id: 'go', name: 'Go', ext: '.go' },
  { id: 'rust', name: 'Rust', ext: '.rs' },
  { id: 'typescript', name: 'TypeScript', ext: '.ts' },
  { id: 'sql', name: 'SQL', ext: '.sql' },
];

const CODE_TEMPLATES = {
  javascript: `// JavaScript Solution
function solution() {
    // Your code here
    return result;
}

// Test your function
console.log(solution());`,
  
  python: `# Python Solution
def solution():
    # Your code here
    return result

# Test your function
print(solution())`,
  
  java: `// Java Solution
public class Solution {
    public static void main(String[] args) {
        Solution sol = new Solution();
        // Test your solution
        System.out.println(sol.solve());
    }
    
    public int solve() {
        // Your code here
        return result;
    }
}`,
  
  cpp: `// C++ Solution
#include <iostream>
#include <vector>
#include <string>
using namespace std;

class Solution {
public:
    int solve() {
        // Your code here
        return result;
    }
};

int main() {
    Solution sol;
    cout << sol.solve() << endl;
    return 0;
}`,
  
  c: `// C Solution
#include <stdio.h>
#include <stdlib.h>

int solution() {
    // Your code here
    return result;
}

int main() {
    printf("%d\\n", solution());
    return 0;
}`,
  
  csharp: `// C# Solution
using System;

public class Solution {
    public static void Main() {
        Solution sol = new Solution();
        Console.WriteLine(sol.Solve());
    }
    
    public int Solve() {
        // Your code here
        return result;
    }
}`,
  
  go: `// Go Solution
package main

import "fmt"

func solution() int {
    // Your code here
    return result
}

func main() {
    fmt.Println(solution())
}`,
  
  rust: `// Rust Solution
fn solution() -> i32 {
    // Your code here
    result
}

fn main() {
    println!("{}", solution());
}`,
  
  typescript: `// TypeScript Solution
function solution(): number {
    // Your code here
    return result;
}

// Test your function
console.log(solution());`,
  
  sql: `-- SQL Solution
-- Write your query here
SELECT 
    -- columns
FROM table_name
WHERE condition;`
};

export default function CodeEditor({ value, onChange, onSubmit, onKeystroke, disabled = false, className = '' }: CodeEditorProps) {
  const [selectedLanguage, setSelectedLanguage] = useState('python');
  const [explanation, setExplanation] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fontSize, setFontSize] = useState(14);
  const [showLineNumbers, setShowLineNumbers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const keystrokeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Keystroke tracking with debounce
  const handleKeystroke = (newValue: string) => {
    onChange(newValue);
    
    if (onKeystroke) {
      // Clear existing timeout
      if (keystrokeTimeoutRef.current) {
        clearTimeout(keystrokeTimeoutRef.current);
      }
      
      // Debounce keystroke events (300ms delay)
      keystrokeTimeoutRef.current = setTimeout(() => {
        onKeystroke(newValue, selectedLanguage);
      }, 300);
    }
  };

  // Initialize with template when language changes
  useEffect(() => {
    if (!value || value.trim() === '') {
      onChange(CODE_TEMPLATES[selectedLanguage as keyof typeof CODE_TEMPLATES] || '');
    }
  }, [selectedLanguage]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [value]);

  // Handle tab key for indentation
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const newValue = value.substring(0, start) + '    ' + value.substring(end);
      onChange(newValue);
      
      // Set cursor position after the inserted tab
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 4;
        }
      }, 0);
    } else if (e.key === 'Enter' && e.ctrlKey) {
      handleSubmit();
    }
  };

  const handleSubmit = async () => {
    if (!value.trim()) {
      alert('Please write some code before submitting!');
      return;
    }
    
    setIsSubmitting(true);
    try {
      await onSubmit(value, selectedLanguage, explanation);
      setExplanation('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const loadTemplate = () => {
    const template = CODE_TEMPLATES[selectedLanguage as keyof typeof CODE_TEMPLATES];
    if (template) {
      onChange(template);
    }
  };

  const clearCode = () => {
    if (confirm('Are you sure you want to clear all code?')) {
      onChange('');
    }
  };

  const copyCode = () => {
    navigator.clipboard.writeText(value);
    // You could add a toast notification here
  };

  const getLineNumbers = () => {
    const lines = value.split('\n');
    return lines.map((_, index) => index + 1).join('\n');
  };

  const editorClasses = `
    ${isFullscreen ? 'fixed inset-0 z-50 bg-gray-900' : 'relative'}
    ${className}
  `;

  return (
    <div ref={containerRef} className={`code-editor-container ${editorClasses}`}>
      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden code-editor-transition">
        {/* Header */}
        <div className="bg-gray-800 border-b border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-4">
              <h3 className="text-lg font-semibold text-blue-400">Code Editor</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">Language:</span>
                <select
                  value={selectedLanguage}
                  onChange={(e) => setSelectedLanguage(e.target.value)}
                  disabled={disabled}
                  className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600 text-sm focus:outline-none focus:border-blue-500"
                >
                  {LANGUAGES.map(lang => (
                    <option key={lang.id} value={lang.id}>
                      {lang.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {/* Font Size Controls */}
              <div className="flex items-center space-x-1">
                <button
                  onClick={() => setFontSize(Math.max(10, fontSize - 1))}
                  className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center"
                >
                  A-
                </button>
                <span className="text-xs text-gray-400 w-6 text-center">{fontSize}</span>
                <button
                  onClick={() => setFontSize(Math.min(24, fontSize + 1))}
                  className="w-6 h-6 bg-gray-700 hover:bg-gray-600 rounded text-white text-xs flex items-center justify-center"
                >
                  A+
                </button>
              </div>
              
              {/* Line Numbers Toggle */}
              <button
                onClick={() => setShowLineNumbers(!showLineNumbers)}
                className={`px-2 py-1 rounded text-xs transition-colors ${
                  showLineNumbers ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                #
              </button>
              
              {/* Fullscreen Toggle */}
              <button
                onClick={toggleFullscreen}
                className="p-1 hover:bg-gray-700 rounded text-gray-400 hover:text-white transition-colors"
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen'}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isFullscreen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.5 3.5M15 9V4.5M15 9H19.5M15 9L20.5 3.5M9 15V19.5M9 15H4.5M9 15L3.5 20.5M15 15V19.5M15 15H19.5M15 15L20.5 20.5" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  )}
                </svg>
              </button>
            </div>
          </div>
          
          {/* Toolbar */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <button
                onClick={loadTemplate}
                disabled={disabled}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white text-xs rounded transition-colors"
              >
                Load Template
              </button>
              <button
                onClick={copyCode}
                disabled={disabled || !value.trim()}
                className="px-3 py-1 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white text-xs rounded transition-colors"
              >
                Copy Code
              </button>
              <button
                onClick={clearCode}
                disabled={disabled || !value.trim()}
                className="px-3 py-1 bg-red-700 hover:bg-red-600 disabled:bg-gray-800 text-white text-xs rounded transition-colors"
              >
                Clear
              </button>
            </div>
            
            <div className="flex items-center space-x-2 text-xs text-gray-400">
              <span>Lines: {value.split('\n').length}</span>
              <span>•</span>
              <span>Chars: {value.length}</span>
              <span>•</span>
              <span>Ctrl+Enter to submit</span>
            </div>
          </div>
        </div>

        {/* Code Area */}
        <div className="relative">
          <div className="flex" style={{ height: isFullscreen ? 'calc(100vh - 200px)' : '400px' }}>
            {/* Line Numbers */}
            {showLineNumbers && (
              <div 
                className="bg-gray-850 border-r border-gray-700 px-2 py-3 text-gray-500 text-right select-none overflow-hidden"
                style={{ 
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.5',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace'
                }}
              >
                <pre className="whitespace-pre">{getLineNumbers()}</pre>
              </div>
            )}
            
            {/* Code Input */}
            <div className="flex-1 relative">
              <textarea
                ref={textareaRef}
                value={value}
                onChange={(e) => handleKeystroke(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`// Write your ${LANGUAGES.find(l => l.id === selectedLanguage)?.name || 'code'} solution here...\n// Press Tab for indentation\n// Press Ctrl+Enter to submit`}
                disabled={disabled}
                className="code-editor-textarea w-full h-full bg-gray-800 text-white placeholder-gray-500 resize-none focus:outline-none border-none p-3 overflow-auto"
                style={{ 
                  fontSize: `${fontSize}px`,
                  lineHeight: '1.5',
                  fontFamily: 'Monaco, Menlo, "Ubuntu Mono", Consolas, source-code-pro, monospace',
                  minHeight: isFullscreen ? 'calc(100vh - 200px)' : '400px'
                }}
                spellCheck={false}
              />
              
              {/* Syntax highlighting overlay could go here */}
            </div>
          </div>
        </div>

        {/* Explanation Area */}
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Explanation (Optional)
          </label>
          <textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            placeholder="Explain your approach, time complexity, space complexity, or any assumptions..."
            disabled={disabled}
            className="w-full h-20 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white placeholder-gray-400 text-sm focus:outline-none focus:border-blue-500 resize-none"
          />
        </div>

        {/* Submit Button */}
        <div className="bg-gray-800 border-t border-gray-700 p-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-gray-400">
              💡 Tip: Explain your approach above and write clean, commented code
            </div>
            <button
              onClick={handleSubmit}
              disabled={disabled || !value.trim() || isSubmitting}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white font-medium rounded-lg transition-colors flex items-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Submitting...</span>
                </>
              ) : (
                <>
                  <span>Submit Solution</span>
                  <span className="text-xs opacity-75">(Ctrl+Enter)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
