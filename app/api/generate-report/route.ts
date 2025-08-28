import { NextRequest, NextResponse } from 'next/server';
import { InterviewOrchestrator } from '../../../lib/services/orchestrator';

// In-memory storage for orchestrators by session (in production, use Redis or database)
const orchestrators = new Map<string, InterviewOrchestrator>();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, resumeFilePath, reportType } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    if (!resumeFilePath) {
      return NextResponse.json(
        { error: 'Resume file path is required' },
        { status: 400 }
      );
    }

    // Get orchestrator for session
    const orchestrator = orchestrators.get(sessionId);
    if (!orchestrator) {
      return NextResponse.json(
        { error: 'No active interview session found' },
        { status: 404 }
      );
    }

    let result;
    const validReportTypes = ['scoring', 'recommendation', 'full'];
    const type = reportType || 'full';

    if (!validReportTypes.includes(type)) {
      return NextResponse.json(
        { error: 'Invalid report type. Must be: scoring, recommendation, or full' },
        { status: 400 }
      );
    }

    switch (type) {
      case 'scoring':
        result = {
          scoring: await orchestrator.generateScoringReport(resumeFilePath),
          type: 'scoring'
        };
        break;

      case 'recommendation':
        result = {
          recommendation: await orchestrator.generateRecommendationReport(resumeFilePath),
          type: 'recommendation'
        };
        break;

      case 'full':
      default:
        result = {
          ...(await orchestrator.generateFullReport(resumeFilePath)),
          type: 'full'
        };
        break;
    }

    return NextResponse.json({
      sessionId,
      success: true,
      reportType: type,
      generatedAt: new Date().toISOString(),
      ...result
    });

  } catch (error) {
    console.error('Error generating report:', error);
    return NextResponse.json(
      { 
        error: 'Failed to generate report',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
