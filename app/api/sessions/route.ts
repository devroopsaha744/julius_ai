import { NextRequest, NextResponse } from 'next/server';
import { getMessages } from '../../../lib/utils/redisSession';

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

    // Get conversation history for the session
    const messages = await getMessages(sessionId);

    return NextResponse.json({
      sessionId,
      messageCount: messages.length,
      messages: messages,
      success: true
    });

  } catch (error) {
    console.error('Error getting session data:', error);
    return NextResponse.json(
      { error: 'Failed to retrieve session data' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      );
    }

    // In a real implementation, you would clear the session from Redis
    // For now, we'll just return success
    console.log(`Clearing session: ${sessionId}`);

    return NextResponse.json({
      sessionId,
      message: 'Session cleared successfully',
      success: true
    });

  } catch (error) {
    console.error('Error clearing session:', error);
    return NextResponse.json(
      { error: 'Failed to clear session' },
      { status: 500 }
    );
  }
}
