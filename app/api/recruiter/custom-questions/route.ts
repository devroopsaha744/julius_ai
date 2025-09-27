import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/julis-ai';
const client = new MongoClient(mongoUri);

interface CustomQuestions {
  greet: string[];
  resume: string[];
  cs: string[];
  behave: string[];
  wrap_up: string[];
  coding: string[];
}

interface CustomPrompts {
  interview: string;
  coding: string;
}

interface RecruiterConfig {
  recruiterId: string;
  questions: CustomQuestions;
  prompts: CustomPrompts;
  updatedAt: Date;
}

export async function GET() {
  try {
    await client.connect();
    const db = client.db();
    const collection = db.collection<RecruiterConfig>('recruiter_configs');

    // For now, use a default recruiter ID. In production, this should come from authentication
    const recruiterId = 'default_recruiter';

    const config = await collection.findOne({ recruiterId });

    if (!config) {
      return NextResponse.json({
        questions: {
          greet: [],
          resume: [],
          cs: [],
          behave: [],
          wrap_up: [],
          coding: []
        },
        prompts: {
          interview: '',
          coding: ''
        }
      });
    }

    return NextResponse.json({
      questions: config.questions,
      prompts: config.prompts
    });
  } catch (error) {
    console.error('Failed to load custom questions:', error);
    return NextResponse.json({ error: 'Failed to load custom questions' }, { status: 500 });
  } finally {
    await client.close();
  }
}

export async function POST(request: NextRequest) {
  try {
    const { questions }: { questions: CustomQuestions } = await request.json();

    await client.connect();
    const db = client.db();
    const collection = db.collection<RecruiterConfig>('recruiter_configs');

    // For now, use a default recruiter ID. In production, this should come from authentication
    const recruiterId = 'default_recruiter';

    await collection.updateOne(
      { recruiterId },
      {
        $set: {
          questions,
          updatedAt: new Date()
        },
        $setOnInsert: {
          prompts: {
            interview: '',
            coding: ''
          }
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Failed to save custom questions:', error);
    return NextResponse.json({ error: 'Failed to save custom questions' }, { status: 500 });
  } finally {
    await client.close();
  }
}