import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/utils/mongoConnection';
import InterviewSession from '../../../../lib/models/InterviewSession';
import Interview from '../../../../lib/models/Interview';
import User from '../../../../lib/models/User';

type TokenInfo = {
  aud?: string;
  sub: string;
  email?: string;
  name?: string;
};

async function verifyIdToken(idToken: string) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) return null;
  const info = (await res.json()) as TokenInfo;
  const expectedClientId = process.env.GOOGLE_CLIENT_ID;
  if (expectedClientId && info.aud && info.aud !== expectedClientId) return null;
  return info;
}

export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const recruiterIdParam = url.searchParams.get('recruiterId');

    // Try to verify id_token from Authorization header if provided
    const authHeader = req.headers.get('authorization');
    let recruiterId: string | null = null;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring('Bearer '.length);
      const info = await verifyIdToken(token);
      if (!info) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

      // Find user by google sub
      await dbConnect();
  const user = (await User.findOne({ googleId: info.sub }).lean()) as any;
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  recruiterId = String(user._id);
    }

    if (!recruiterId && recruiterIdParam) recruiterId = recruiterIdParam;

    await dbConnect();

    // For authenticated user, fetch their interviews
    if (recruiterId) {
      const interviews = await Interview.find({ userId: recruiterId }).sort({ createdAt: -1 }).limit(100).lean();
      return NextResponse.json({ ok: true, interviews });
    }

    // Fallback to sessions if no user
    const sessions = await InterviewSession.find({}).sort({ createdAt: -1 }).limit(100).lean();
    return NextResponse.json({ ok: true, sessions });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('GET /api/user/interviews error', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
