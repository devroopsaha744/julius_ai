"use client";
import React, { useEffect, useState } from 'react';

type InterviewSummary = {
  _id: string;
  sessionId: string;
  candidateName?: string;
  candidateEmail?: string;
  state?: string;
  createdAt?: string;
};

export default function ProfilePage() {
  const [idToken, setIdToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [sessions, setSessions] = useState<InterviewSummary[]>([]);

  useEffect(() => {
    const t = localStorage.getItem('id_token');
    if (t) setIdToken(t);

    // load google sdk
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.onload = () => {
      // @ts-ignore
      if (window.google) {
        // @ts-ignore
        window.google.accounts.id.initialize({
          client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '',
          callback: (res: any) => {
            const token = res.credential;
            localStorage.setItem('id_token', token);
            setIdToken(token);
            fetchUser(token);
            fetchSessions(token);
          },
        });
        // @ts-ignore
        window.google.accounts.id.renderButton(document.getElementById('gsi')!, { theme: 'outline', size: 'large' });
      }
    };
    document.body.appendChild(script);

    if (t) {
      fetchUser(t);
      fetchSessions(t);
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

  async function fetchSessions(token: string) {
    const res = await fetch('/api/user/interviews', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data?.sessions) setSessions(data.sessions);
  }

  function signOut() {
    localStorage.removeItem('id_token');
    setIdToken(null);
    setUser(null);
    setSessions([]);
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Profile</h1>
      {!idToken && (
        <div>
          <div id="gsi"></div>
          <p>Click the Google Sign-In button to authenticate.</p>
        </div>
      )}

      {idToken && !user && <p>Signing in...</p>}

      {user && (
        <div>
          <img src={user.picture} alt="avatar" width={64} height={64} style={{ borderRadius: 8 }} />
          <h2>{user.name}</h2>
          <p>{user.email}</p>
          <button onClick={signOut}>Sign out</button>
        </div>
      )}

      <hr />

      <h2>Your Interviews</h2>
      {sessions.length === 0 && <p>No interviews yet.</p>}
      <ul>
        {sessions.map((s) => (
          <li key={s._id}>
            <a href={`/interviews/${s._id}`}>{s.candidateName || s.candidateEmail || s.sessionId}</a>
            {' — '}
            <small>{new Date(s.createdAt || '').toLocaleString()}</small>
          </li>
        ))}
      </ul>
    </div>
  );
}
