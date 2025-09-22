import { NextResponse } from 'next/server';

const JUDGE0_URL = process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_KEY = process.env.JUDGE0_KEY || '';

export async function POST(req: Request) {
  const body = await req.json();

  // Normalize payload for Judge0: source_code, language, stdin
  const payload = {
    source_code: body.source_code,
    language_id: body.language === 'python' ? 71 : body.language === 'cpp' ? 54 : 63, // basic mapping
    stdin: body.stdin || ''
  };

  try {
    const res = await fetch(`${JUDGE0_URL}/submissions?base64_encoded=false&wait=false`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(JUDGE0_KEY ? { 'X-RapidAPI-Key': JUDGE0_KEY } : {})
      },
      body: JSON.stringify(payload)
    });

    const json = await res.json();
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
