import { NextResponse } from 'next/server';

const JUDGE0_URL = process.env.JUDGE0_URL || 'https://judge0-ce.p.rapidapi.com';
const JUDGE0_KEY = process.env.JUDGE0_KEY || '';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const token = searchParams.get('token');

  if (!token) {
    return NextResponse.json({ error: 'token required' }, { status: 400 });
  }

  try {
    const res = await fetch(`${JUDGE0_URL}/submissions/${token}?base64_encoded=false`, {
      headers: {
        ...(JUDGE0_KEY ? { 'X-RapidAPI-Key': JUDGE0_KEY } : {})
      }
    });

    const json = await res.json();
    return NextResponse.json(json);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}