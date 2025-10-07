import { NextResponse } from 'next/server';
import dbConnect from '../../../../lib/utils/mongoConnection';
import InterviewSession from '../../../../lib/models/InterviewSession';

export async function POST(req: Request) {
  await dbConnect();
  const body = await req.json();

  const { recruiterId, candidateName, candidateEmail, type = 'combined' } = body;

  if (!recruiterId) {
    return NextResponse.json({ error: 'Recruiter ID is required' }, { status: 400 });
  }

  // Create a new combined session
  const sessionId = `combined_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const session = new InterviewSession({
    sessionId,
    recruiterId,
    candidateName,
    candidateEmail,
    type,
    state: 'greet', // Start with interview
  });

  await session.save();

  // Generate shareable link
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  const shareableLink = `${baseUrl}/combined-test?sessionId=${sessionId}`;

  return NextResponse.json({
    sessionId,
    shareableLink,
    session
  });
}