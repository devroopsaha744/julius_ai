import { NextRequest, NextResponse } from 'next/server';
import { InterviewOrchestrator } from '../../../lib/services/orchestrator';

// In-memory storage for orchestrators by session (in production, use Redis or database)
const orchestrators = new Map<string, InterviewOrchestrator>();

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

    // Get or create orchestrator for session
    let orchestrator = orchestrators.get(sessionId);
    if (!orchestrator) {
      orchestrator = new InterviewOrchestrator(sessionId);
      orchestrators.set(sessionId, orchestrator);
    }

    const currentStage = orchestrator.getCurrentStage();
    const nextStage = orchestrator.getNextStage();
    const isCompleted = orchestrator.isCompleted();

    return NextResponse.json({
      sessionId,
      currentStage,
      nextStage,
      isCompleted,
      success: true
    });

  } catch (error) {
    console.error('Error getting interview stage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, stage } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!stage) {
      return NextResponse.json(
        { error: 'Stage is required' },
        { status: 400 }
      );
    }

    // Get or create orchestrator for session
    let orchestrator = orchestrators.get(sessionId);
    if (!orchestrator) {
      orchestrator = new InterviewOrchestrator(sessionId);
      orchestrators.set(sessionId, orchestrator);
    }

    // Set the stage
    orchestrator.setStage(stage);

    return NextResponse.json({
      sessionId,
      currentStage: orchestrator.getCurrentStage(),
      success: true,
      message: `Stage set to ${stage}`
    });

  } catch (error) {
    console.error('Error setting interview stage:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
