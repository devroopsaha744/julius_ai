'use client';

import React, { useState, useEffect } from 'react';

interface CustomQuestions {
  greet: string[];
  resume: string[];
  cs: string[];
  behave: string[];
  wrap_up: string[];
  coding: string[];
}

interface CustomPrompts {
  interview: string;
  coding: string;
}

export default function RecruiterDashboard() {
  const [user, setUser] = useState<any>(() => {
    try {
      if (typeof window === 'undefined') return null;
      const raw = localStorage.getItem('julius_user');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });

  const [customQuestions, setCustomQuestions] = useState<CustomQuestions>({
    greet: [],
    resume: [],
    cs: [],
    behave: [],
    wrap_up: [],
    coding: []
  });

  const [customPrompts, setCustomPrompts] = useState<CustomPrompts>({
    interview: '',
    coding: ''
  });

  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    if (!user) {
      window.location.href = '/profile';
      return;
    }
    loadCustomQuestions();
  }, [user]);

  const loadCustomQuestions = async () => {
    try {
      const res = await fetch('/api/recruiter/custom-questions');
      if (res.ok) {
        const data = await res.json();
        setCustomQuestions(data.questions || customQuestions);
        setCustomPrompts(data.prompts || customPrompts);
      }
    } catch (error) {
      console.error('Failed to load custom questions:', error);
    }
  };

  const saveCustomQuestions = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/recruiter/custom-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: customQuestions })
      });
      if (res.ok) {
        alert('Custom questions saved successfully!');
      } else {
        alert('Failed to save custom questions');
      }
    } catch (error) {
      console.error('Failed to save custom questions:', error);
      alert('Failed to save custom questions');
    } finally {
      setLoading(false);
    }
  };

  const generatePrompts = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/recruiter/generate-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ questions: customQuestions })
      });
      if (res.ok) {
        const data = await res.json();
        setCustomPrompts(data.prompts);
        alert('Prompts generated successfully!');
      } else {
        alert('Failed to generate prompts');
      }
    } catch (error) {
      console.error('Failed to generate prompts:', error);
      alert('Failed to generate prompts');
    } finally {
      setGenerating(false);
    }
  };

  const addQuestion = (stage: keyof CustomQuestions) => {
    setCustomQuestions(prev => ({
      ...prev,
      [stage]: [...prev[stage], '']
    }));
  };

  const updateQuestion = (stage: keyof CustomQuestions, index: number, value: string) => {
    setCustomQuestions(prev => ({
      ...prev,
      [stage]: prev[stage].map((q, i) => i === index ? value : q)
    }));
  };

  const removeQuestion = (stage: keyof CustomQuestions, index: number) => {
    setCustomQuestions(prev => ({
      ...prev,
      [stage]: prev[stage].filter((_, i) => i !== index)
    }));
  };

  const stages = [
    { key: 'greet' as keyof CustomQuestions, name: 'Greeting & Introduction', description: 'Welcome and initial questions' },
    { key: 'resume' as keyof CustomQuestions, name: 'Resume Review', description: 'Project and experience discussion' },
    { key: 'cs' as keyof CustomQuestions, name: 'Computer Science Fundamentals', description: 'Technical knowledge assessment' },
    { key: 'behave' as keyof CustomQuestions, name: 'Behavioral Questions', description: 'Soft skills and teamwork' },
    { key: 'wrap_up' as keyof CustomQuestions, name: 'Wrap-up', description: 'Final questions and feedback' },
    { key: 'coding' as keyof CustomQuestions, name: 'Coding Challenges', description: 'Custom coding problem requirements' }
  ];

  return (
    <div className="min-h-screen bg-white text-black overflow-hidden">
      {/* Animated Background */}
      <div className="fixed inset-0 opacity-12">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-400/12 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/12 rounded-full blur-3xl animate-pulse delay-1000"></div>
      </div>

      <div className="relative z-10 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-4xl font-bold accent-text mb-2">Recruiter Dashboard</h1>
            <p className="text-lg text-gray-600">Customize interview questions and coding challenges for your candidates</p>
          </div>

          {/* Custom Questions Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {stages.map((stage) => (
              <div key={stage.key} className="glass-effect rounded-xl border border-gray-200/30 p-6">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-purple-700">{stage.name}</h3>
                    <p className="text-sm text-gray-600">{stage.description}</p>
                  </div>
                  <button
                    onClick={() => addQuestion(stage.key)}
                    className="btn-outline-electric px-3 py-1 text-sm"
                  >
                    + Add Question
                  </button>
                </div>

                <div className="space-y-3">
                  {customQuestions[stage.key].map((question, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="text"
                        value={question}
                        onChange={(e) => updateQuestion(stage.key, index, e.target.value)}
                        placeholder={`Question ${index + 1} for ${stage.name.toLowerCase()}`}
                        className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-purple-400"
                      />
                      <button
                        onClick={() => removeQuestion(stage.key, index)}
                        className="text-red-500 hover:text-red-700 px-2 py-1"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {customQuestions[stage.key].length === 0 && (
                    <p className="text-sm text-gray-500 italic">No custom questions added. Will use default questions.</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Action Buttons */}
          <div className="flex justify-center space-x-4 mb-8">
            <button
              onClick={saveCustomQuestions}
              disabled={loading}
              className="btn-primary px-8 py-3 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save Custom Questions'}
            </button>
            <button
              onClick={generatePrompts}
              disabled={generating}
              className="btn-electric px-8 py-3 disabled:opacity-50"
            >
              {generating ? 'Generating...' : 'Generate Custom Prompts'}
            </button>
          </div>

          {/* Generated Prompts Preview */}
          {(customPrompts.interview || customPrompts.coding) && (
            <div className="space-y-6">
              {customPrompts.interview && (
                <div className="glass-effect rounded-xl border border-gray-200/30 p-6">
                  <h3 className="text-xl font-semibold text-purple-700 mb-4">Generated Interview Prompt</h3>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg border overflow-x-auto">
                    {customPrompts.interview}
                  </pre>
                </div>
              )}

              {customPrompts.coding && (
                <div className="glass-effect rounded-xl border border-gray-200/30 p-6">
                  <h3 className="text-xl font-semibold text-purple-700 mb-4">Generated Coding Curator Prompt</h3>
                  <pre className="whitespace-pre-wrap text-sm bg-gray-50 p-4 rounded-lg border overflow-x-auto">
                    {customPrompts.coding}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}