"use client";
import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Sparkles, User, Calendar, CheckCircle2 } from 'lucide-react';
import ModernHeader from '../components/ModernHeader';
import AnimatedBackground from '../components/AnimatedBackground';

type InterviewSummary = {
  _id: string;
  sessionId: string;
  status: string;
  createdAt?: string;
  conversationalReport?: any;
  codingReport?: any;
  finalReport?: any;
};

export default function ProfilePage() {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [interviews, setInterviews] = useState<InterviewSummary[]>([]);
  const [selectedInterview, setSelectedInterview] = useState<InterviewSummary | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('id_token');
    if (t) setIdToken(t);

    // load google sdk
    const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) {
      console.error('NEXT_PUBLIC_GOOGLE_CLIENT_ID is not set. Google Sign-In will not work.');
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      if (window.google) {
        // @ts-ignore
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (res: any) => {
            const token = res.credential;
            localStorage.setItem('id_token', token);
            setIdToken(token);
            fetchUser(token);
            fetchInterviews(token);
          },
        });
        // @ts-ignore
        window.google.accounts.id.renderButton(document.getElementById('gsi')!, { theme: 'outline', size: 'large' });
      }
    };
    document.body.appendChild(script);

    if (t) {
      fetchUser(t);
      fetchInterviews(t);
    }

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  async function fetchUser(token: string) {
    const res = await fetch('/api/auth/google', { method: 'POST', body: JSON.stringify({ id_token: token }) });
    const data = await res.json();
    if (data?.user) setUser(data.user);
  }

  async function fetchInterviews(token: string) {
    const res = await fetch('/api/user/interviews', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data?.interviews) setInterviews(data.interviews);
  }

  function signOut() {
    localStorage.removeItem('id_token');
    setIdToken(null);
    setUser(null);
    setInterviews([]);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-white via-purple-50/30 to-blue-50/30 text-gray-900 overflow-hidden relative">
      <AnimatedBackground />
      <ModernHeader title="Your Profile" />
      
      <div className="relative z-10 p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <div className="inline-flex items-center space-x-2 px-4 py-2 bg-purple-100/80 backdrop-blur-sm rounded-full mb-4 border border-purple-200/50">
              <User className="w-4 h-4 text-purple-600" />
              <span className="text-sm font-semibold text-purple-700">Profile Management</span>
            </div>
            <h1 className="text-5xl font-bold mb-3">
              <span className="bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                Your Profile
              </span>
            </h1>
            <p className="text-lg text-gray-600">
              Manage your account and view past interviews
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200/50 shadow-lg"
            >
              {!idToken && (
                <div>
                  <div id="gsi" className="mb-4"></div>
                  <p className="text-sm text-gray-600">Click the Google Sign-In button to authenticate.</p>
                </div>
              )}

              {idToken && !user && (
                <div className="flex items-center justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
                  <p className="text-sm text-gray-600 ml-3">Signing in...</p>
                </div>
              )}

              {user && (
                <div className="space-y-4">
                  <div className="relative">
                    <img 
                      src={user.picture} 
                      alt="avatar" 
                      width={96} 
                      height={96} 
                      className="rounded-2xl mx-auto shadow-lg border-4 border-purple-200" 
                    />
                  </div>
                  <div className="text-center">
                    <div className="text-xl font-bold text-gray-900">{user.name}</div>
                    <div className="text-sm text-gray-600">{user.email}</div>
                  </div>
                  <button 
                    onClick={signOut} 
                    className="w-full px-4 py-2 bg-gradient-to-r from-red-500 to-pink-500 text-white rounded-xl font-medium hover:from-red-600 hover:to-pink-600 transition-all shadow-lg"
                  >
                    Sign out
                  </button>
                </div>
              )}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="md:col-span-2 space-y-4"
            >
              <div className="bg-white/80 backdrop-blur-sm p-6 rounded-2xl border border-gray-200/50 shadow-lg">
                <h3 className="font-semibold text-2xl mb-4 bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
                  Your Interviews
                </h3>
                {interviews.length === 0 && (
                  <p className="text-sm text-gray-600 mt-2">No interviews yet. Start your first interview!</p>
                )}
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                  {interviews.map((interview, idx) => (
                    <motion.div
                      key={interview._id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.1 }}
                      className="p-4 rounded-xl border border-gray-200 bg-gradient-to-br from-white to-purple-50/30 hover:shadow-lg hover:border-purple-300 cursor-pointer transition-all"
                      onClick={() => setSelectedInterview(interview)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-medium text-gray-900">Interview #{interview.sessionId.slice(0, 8)}</div>
                        <Calendar className="w-4 h-4 text-gray-500" />
                      </div>
                      <div className="text-xs text-gray-500 mb-3">
                        {new Date(interview.createdAt || '').toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                          interview.status === 'completed' 
                            ? 'bg-green-100 text-green-700 border border-green-200' 
                            : 'bg-yellow-100 text-yellow-700 border border-yellow-200'
                        }`}>
                          {interview.status === 'completed' && <CheckCircle2 className="w-3 h-3 inline mr-1" />}
                          {interview.status}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Interview Report Modal */}
      {selectedInterview && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
          >
            <div className="sticky top-0 bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-3xl font-bold">Interview Report</h2>
                <button 
                  onClick={() => setSelectedInterview(null)} 
                  className="text-white hover:bg-white/20 rounded-lg p-2 transition-all"
                >
                  <span className="text-3xl">×</span>
                </button>
              </div>
            </div>
            <div className="p-6">

              {selectedInterview.finalReport ? (
                <div className="space-y-6">
                  {/* Final Recommendation */}
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <h3 className="font-semibold text-lg mb-2">Final Recommendation</h3>
                    <p className="text-sm">{selectedInterview.finalReport.finalAdvice}</p>
                  </div>

                  {/* Recommendations */}
                  <div>
                    <h3 className="font-semibold text-lg mb-4">Recommendations</h3>
                    <div className="space-y-4">
                      {selectedInterview.finalReport.recommendations.map((rec: any, i: number) => (
                        <div key={i} className="border rounded-lg p-4">
                          <h4 className="font-medium mb-2">{rec.category}</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                              <strong>Strengths:</strong>
                              <ul className="mt-1 space-y-1">
                                {rec.strengths.map((s: string, j: number) => (
                                  <li key={j} className="flex items-start">
                                    <span className="text-green-600 mr-2">✓</span>
                                    {s}
                                  </li>
                                ))}
                              </ul>
                            </div>
                            <div>
                              <strong>Areas for Improvement:</strong>
                              <ul className="mt-1 space-y-1">
                                {rec.areasOfImprovement.map((a: string, j: number) => (
                                  <li key={j} className="flex items-start">
                                    <span className="text-red-600 mr-2">✗</span>
                                    {a}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                          <div className="mt-3">
                            <strong>Actionable Tips:</strong>
                            <ul className="mt-1 space-y-1 text-sm">
                              {rec.actionableTips.map((t: string, j: number) => (
                                <li key={j}>• {t}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Conversational Report */}
                  {selectedInterview.conversationalReport && (
                    <div>
                      <h3 className="font-semibold text-lg mb-4">Conversational Interview Scores</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Object.entries(selectedInterview.conversationalReport.overall).map(([key, value]: [string, any]) => (
                          <div key={key} className="text-center p-3 bg-gray-50 rounded">
                            <div className="text-lg font-bold">{value}</div>
                            <div className="text-xs text-gray-600">{key.replace(/_/g, ' ')}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Coding Report */}
                  {selectedInterview.codingReport && (
                    <div>
                      <h3 className="font-semibold text-lg mb-4">Coding Test Results</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="text-center p-4 bg-blue-50 rounded-lg">
                          <div className="text-2xl font-bold text-blue-600">{selectedInterview.codingReport.correctness}/10</div>
                          <div className="text-sm text-gray-600">Correctness</div>
                        </div>
                        <div className="text-center p-4 bg-green-50 rounded-lg">
                          <div className="text-2xl font-bold text-green-600">{selectedInterview.codingReport.optimization}/10</div>
                          <div className="text-sm text-gray-600">Optimization</div>
                        </div>
                        <div className="text-center p-4 bg-purple-50 rounded-lg">
                          <div className="text-2xl font-bold text-purple-600">{selectedInterview.codingReport.readability}/10</div>
                          <div className="text-sm text-gray-600">Readability</div>
                        </div>
                      </div>
                      <div className="text-sm">
                        <p>{selectedInterview.codingReport.feedback}</p>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-gray-600">Report not available yet.</p>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </div>
  );
}
