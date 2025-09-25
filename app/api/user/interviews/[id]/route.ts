import { NextResponse } from 'next/server';
import dbConnect from 'lib/utils/mongoConnection';
import InterviewSession from 'lib/models/InterviewSession';
import Message from 'lib/models/Message';
import Report from 'lib/models/Report';
import User from 'lib/models/User';

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

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const id = params.id;
    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

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

    const session = (await InterviewSession.findById(id).lean()) as any;
    if (!session) return NextResponse.json({ error: 'Session not found' }, { status: 404 });

    if (recruiterId && String(session.recruiterId) !== recruiterId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const messages = await Message.find({ sessionId: session.sessionId }).sort({ timestamp: 1 }).lean();
    const report = await Report.findOne({ sessionId: session._id }).lean();

    return NextResponse.json({ ok: true, session, messages, report });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('GET /api/user/interviews/[id] error', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
