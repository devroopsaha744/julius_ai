import { NextRequest, NextResponse } from 'next/server';
import { join } from 'path';
import { existsSync, readdirSync } from 'fs';
import { tmpdir } from 'os';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // Check temp directory for resume files (no Redis needed!)
    const tempDir = join(tmpdir(), 'julius-ai-resumes', sessionId);
    let hasResume = false;
    let resumeFileName = null;

    if (existsSync(tempDir)) {
      const files = readdirSync(tempDir);
      const resumeFile = files.find(file => file.startsWith('resume_'));
      if (resumeFile) {
        hasResume = true;
        resumeFileName = resumeFile;
      }
    }

    const response = {
      sessionId,
      hasResume,
      resumeFileName,
      resumeUploadedAt: hasResume ? new Date().toISOString() : null,
      currentStage: 'greet', // Default stage, WebSocket manages actual stage
      interviewComplete: false,
      hasScoring: false,
      hasRecommendation: false,
      canGenerateReport: false,
      success: true,
      message: hasResume ? 'Resume found in temp directory' : 'No resume uploaded yet'
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error getting session status:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session status' },
      { status: 500 }
    );
  }
}
