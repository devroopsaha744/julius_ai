"use client";
import React, { useEffect, useState } from 'react';

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
    <div className="min-h-screen bg-white text-black p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex items-center space-x-4">
          <div className="w-12 h-12 hero-accent rounded-lg flex items-center justify-center overflow-hidden">
            <div style={{ width: 28, height: 28, borderRadius: 6, background: '#6B21A8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ color: 'white', fontWeight: 700 }}>JA</span>
            </div>
          </div>
          <div>
            <h1 className="text-2xl font-bold">Profile</h1>
            <div className="text-xs text-gray-500">Manage your account and view past interviews</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="glass-effect p-4 rounded-xl">
            {!idToken && (
              <div>
                <div id="gsi"></div>
                <p className="text-sm text-gray-600 mt-3">Click the Google Sign-In button to authenticate.</p>
              </div>
            )}

            {idToken && !user && <p className="text-sm text-gray-600">Signing in...</p>}

            {user && (
              <div className="space-y-3">
                <img src={user.picture} alt="avatar" width={72} height={72} className="rounded-lg" />
                <div className="text-lg font-medium">{user.name}</div>
                <div className="text-sm text-gray-600">{user.email}</div>
                <button onClick={signOut} className="mt-2 btn-outline px-3 py-2">Sign out</button>
              </div>
            )}
          </div>

          <div className="md:col-span-2 space-y-4">
            <div className="glass-effect p-4 rounded-xl">
              <h3 className="font-semibold text-lg">Your Interviews</h3>
              {interviews.length === 0 && <p className="text-sm text-gray-600 mt-2">No interviews yet.</p>}
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4">
                {interviews.map((interview) => (
                  <div key={interview._id} className="p-4 rounded-lg border border-gray-200 hover:shadow-md cursor-pointer" onClick={() => setSelectedInterview(interview)}>
                    <div className="font-medium text-gray-800">Interview {interview.sessionId}</div>
                    <div className="text-xs text-gray-500 mt-1">{new Date(interview.createdAt || '').toLocaleString()}</div>
                    <div className="text-xs mt-2">
                      <span className={`px-2 py-1 rounded ${interview.status === 'completed' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
                        {interview.status}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interview Report Modal */}
      {selectedInterview && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg max-w-4xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">Interview Report</h2>
                <button onClick={() => setSelectedInterview(null)} className="text-gray-500 hover:text-gray-700">×</button>
              </div>

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
          </div>
        </div>
      )}
    </div>
  );
}
