'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { X, Plus, Sparkles, Home } from 'lucide-react';

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
  const [creatingLink, setCreatingLink] = useState(false);
  const [shareableLink, setShareableLink] = useState<string | null>(null);

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

  const generateShareableLink = async () => {
    setCreatingLink(true);
    try {
      const res = await fetch('/api/recruiter/generate-link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recruiterId: user?._id || 'default_recruiter',
          type: 'combined'
        })
      });
      if (res.ok) {
        const data = await res.json();
        setShareableLink(data.shareableLink);
        // Copy to clipboard
        navigator.clipboard.writeText(data.shareableLink);
        alert('Shareable link generated and copied to clipboard!');
      } else {
        alert('Failed to generate shareable link');
      }
    } catch (error) {
      console.error('Failed to generate shareable link:', error);
      alert('Failed to generate shareable link');
    } finally {
      setCreatingLink(false);
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
    <div className="min-h-screen bg-gradient-to-br from-white via-purple-50/30 to-blue-50/30 text-gray-900 overflow-hidden relative">
      {/* Animated Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-64 h-64 rounded-full bg-gradient-to-br from-purple-400/20 to-blue-400/20 blur-3xl"
          animate={{
            x: [0, 100, 0],
            y: [0, -100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "easeInOut"
          }}
        />
        <motion.div
          className="absolute right-0 w-64 h-64 rounded-full bg-gradient-to-br from-purple-400/20 to-blue-400/20 blur-3xl"
          animate={{
            x: [0, -100, 0],
            y: [0, 100, 0],
            scale: [1, 1.2, 1],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            delay: 5,
            ease: "easeInOut"
          }}
        />
      </div>

      {/* Navigation */}
      <motion.nav 
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        className="relative z-50 px-6 py-4 backdrop-blur-lg bg-white/70 border-b border-gray-200/50 sticky top-0"
      >
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-blue-600 rounded-xl flex items-center justify-center transform group-hover:scale-110 transition-transform">
              <span className="text-white font-bold text-lg">JA</span>
            </div>
            <span className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Julius AI
            </span>
          </Link>
          
          <Link href="/">
            <Button variant="outline" className="flex items-center space-x-2">
              <Home className="w-4 h-4" />
              <span>Home</span>
            </Button>
          </Link>
        </div>
      </motion.nav>

      <div className="relative z-10 p-6">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8 text-center"
          >
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-100/80 backdrop-blur-sm rounded-full mb-4 border border-purple-200/50">
              <Sparkles className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">Customization Dashboard</span>
            </div>
            <h1 className="text-5xl font-bold mb-3">
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Recruiter Dashboard
              </span>
            </h1>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Customize interview questions and coding challenges for your candidates
            </p>
          </motion.div>

          {/* Custom Questions Section */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {stages.map((stage, idx) => (
              <motion.div
                key={stage.key}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.1 }}
              >
                <Card className="border border-gray-200/50 bg-white/80 backdrop-blur-sm hover:shadow-xl hover:shadow-purple-500/10 transition-all">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                          {stage.name}
                        </CardTitle>
                        <CardDescription className="text-gray-600">{stage.description}</CardDescription>
                      </div>
                      <Button
                        onClick={() => addQuestion(stage.key)}
                        variant="outline"
                        size="sm"
                        className="bg-gradient-to-r from-purple-100 to-blue-100 hover:from-purple-200 hover:to-blue-200 border-purple-300"
                      >
                        <Plus className="w-4 h-4 mr-2" />
                        Add Question
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {customQuestions[stage.key].map((question, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <Input
                            type="text"
                            value={question}
                            onChange={(e) => updateQuestion(stage.key, index, e.target.value)}
                            placeholder={`Question ${index + 1} for ${stage.name.toLowerCase()}`}
                            className="flex-1 border-gray-300"
                          />
                          <Button
                            onClick={() => removeQuestion(stage.key, index)}
                            variant="ghost"
                            size="sm"
                            className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ))}
                      {customQuestions[stage.key].length === 0 && (
                        <p className="text-sm text-gray-500 italic">No custom questions added. Will use default questions.</p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>          {/* Action Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="flex flex-wrap justify-center gap-4 mb-8"
          >
            <Button
              onClick={saveCustomQuestions}
              disabled={loading}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white shadow-lg hover:shadow-xl"
            >
              {loading ? 'Saving...' : 'Save Custom Questions'}
            </Button>
            <Button
              onClick={generatePrompts}
              disabled={generating}
              variant="outline"
              className="px-8 py-3 border-2 border-purple-300 hover:bg-purple-50"
            >
              {generating ? 'Generating...' : 'Generate Custom Prompts'}
            </Button>
            <Button
              onClick={generateShareableLink}
              disabled={creatingLink}
              className="px-8 py-3 bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white shadow-lg"
            >
              {creatingLink ? 'Creating Link...' : 'Generate Shareable Link'}
            </Button>
          </motion.div>

          {/* Generated Prompts Preview */}
          {(customPrompts.interview || customPrompts.coding) && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {customPrompts.interview && (
                <Card className="border border-gray-200/50 bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                      Generated Interview Prompt
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm bg-gradient-to-br from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200 overflow-x-auto">
                      {customPrompts.interview}
                    </pre>
                  </CardContent>
                </Card>
              )}

              {customPrompts.coding && (
                <Card className="border border-gray-200/50 bg-white/80 backdrop-blur-sm">
                  <CardHeader>
                    <CardTitle className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                      Generated Coding Curator Prompt
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="whitespace-pre-wrap text-sm bg-gradient-to-br from-purple-50 to-blue-50 p-4 rounded-lg border border-purple-200 overflow-x-auto">
                      {customPrompts.coding}
                    </pre>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          )}

          {/* Shareable Link */}
          {shareableLink && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <Card className="border border-green-200/50 bg-gradient-to-br from-green-50 to-emerald-50 backdrop-blur-sm">
                <CardHeader>
                  <CardTitle className="text-xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
                    Shareable Assessment Link
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-white p-4 rounded-lg border border-green-300">
                    <p className="text-sm text-green-800 mb-2 font-medium">Your combined interview + coding test link is ready:</p>
                    <div className="flex items-center space-x-2">
                      <Input
                        type="text"
                        value={shareableLink}
                        readOnly
                        className="flex-1 bg-white border-green-300 text-gray-800 font-mono text-sm"
                      />
                      <Button
                        onClick={() => {
                          navigator.clipboard.writeText(shareableLink);
                          alert('Link copied to clipboard!');
                        }}
                        size="sm"
                        className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white"
                      >
                        Copy
                      </Button>
                    </div>
                    <p className="text-xs text-green-600 mt-2">
                      Share this link with candidates. It includes both the interview and coding test in sequence.
                    </p>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}