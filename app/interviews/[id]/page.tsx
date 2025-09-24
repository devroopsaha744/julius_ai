"use client";
import React, { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

export default function InterviewDetailPage() {
  const params = useParams();
  const idParam = params?.id;
  const id = Array.isArray(idParam) ? idParam[0] : idParam;
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('id_token');
  if (id) fetchDetail(id, token || undefined);
  }, [id]);

  async function fetchDetail(id: string, token?: string) {
    const headers: any = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    const res = await fetch(`/api/user/interviews/${id}`, { headers });
    const json = await res.json();
    if (json?.ok) setData(json);
  }

  if (!data) return <div style={{ padding: 24 }}>Loading...</div>;

  const { session, messages, report } = data;

  return (
    <div style={{ padding: 24 }}>
      <h1>Interview — {session.candidateName || session.sessionId}</h1>
      <p>State: {session.state}</p>
      <h2>Conversation</h2>
      <div style={{ background: '#f6f6f6', padding: 12, borderRadius: 8 }}>
        {messages.map((m: any, i: number) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>{m.role}</strong>: <span>{m.content}</span>
          </div>
        ))}
      </div>

      <h2>Report</h2>
      {report ? (
        <div style={{ background: '#fff', padding: 12, borderRadius: 8 }}>
          <pre style={{ whiteSpace: 'pre-wrap' }}>{JSON.stringify(report, null, 2)}</pre>
        </div>
      ) : (
        <p>No report found.</p>
      )}
    </div>
  );
}
