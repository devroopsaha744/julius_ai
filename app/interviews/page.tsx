"use client";
import React, { useEffect, useState } from 'react';

export default function InterviewsPage() {
  const [sessions, setSessions] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('id_token');
    if (token) fetchSessions(token);
  }, []);

  async function fetchSessions(token: string) {
    const res = await fetch('/api/user/interviews', { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json();
    if (data?.sessions) setSessions(data.sessions);
  }

  return (
    <div style={{ padding: 24 }}>
      <h1>Interviews</h1>
      {sessions.length === 0 && <p>No interviews found.</p>}
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
