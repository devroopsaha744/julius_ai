import { NextRequest, NextResponse } from 'next/server';
import codingEvaluator from '../../../lib/services/coding_evaluator';
import Interview from '../../../lib/models/Interview';
import mongoose from 'mongoose';

export async function POST(req: NextRequest) {
  try {
    const { code, language, problem, userId, sessionId } = await req.json();

    if (!code || !language || !problem) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const result = await codingEvaluator.evaluateSingle({ code, language, problem });

    // Save to database
    if (userId && sessionId) {
      try {
        await Interview.findOneAndUpdate(
          { sessionId },
          {
            userId: new mongoose.Types.ObjectId(userId),
            codingReport: result,
            updatedAt: new Date()
          },
          { upsert: true, new: true }
        );
      } catch (error) {
        console.error('Failed to save coding report:', error);
      }
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Evaluation error:', error);
    return NextResponse.json({ error: 'Evaluation failed' }, { status: 500 });
  }
}