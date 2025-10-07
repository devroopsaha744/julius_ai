import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/utils/mongoConnection';
import InterviewSession from '../../../../lib/models/InterviewSession';

export async function GET() {
  await dbConnect();
  const sessions = await InterviewSession.find().limit(50).lean();
  return NextResponse.json(sessions);
}

export async function POST(req: Request) {
  await dbConnect();
  const body = await req.json();
  const s = new InterviewSession({
    sessionId: body.sessionId || `sess_${Date.now()}`,
    recruiterId: body.recruiterId,
    candidateName: body.candidateName,
    candidateEmail: body.candidateEmail,
    type: body.type || 'interview', // 'interview', 'coding', or 'combined'
    state: body.type === 'coding' ? 'coding' : 'greet',
  });
  await s.save();
  return NextResponse.json(s);
}
