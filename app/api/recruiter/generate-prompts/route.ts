import { NextRequest, NextResponse } from 'next/server';
import { groqClient } from '@/lib/utils/groqclient';
import fs from 'fs';
import path from 'path';
import { MongoClient } from 'mongodb';

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

// MongoDB connection
const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/julis-ai';
const client = new MongoClient(mongoUri);

export async function POST(request: NextRequest) {
  try {
    const { questions }: { questions: CustomQuestions } = await request.json();

    // Load base prompts
    const interviewPromptPath = path.join(process.cwd(), 'lib', 'prompts', 'unified_interview.txt');
    const codingPromptPath = path.join(process.cwd(), 'lib', 'prompts', 'coding_curator.txt');

    const baseInterviewPrompt = fs.readFileSync(interviewPromptPath, 'utf-8');
    const baseCodingPrompt = fs.readFileSync(codingPromptPath, 'utf-8');

    // Generate custom interview prompt
    const interviewPrompt = await generateInterviewPrompt(baseInterviewPrompt, questions);

    // Generate custom coding prompt
    const codingPrompt = await generateCodingPrompt(baseCodingPrompt, questions.coding);

    const customPrompts: CustomPrompts = {
      interview: interviewPrompt,
      coding: codingPrompt
    };

    // Save to database
    await client.connect();
    const db = client.db();
    const collection = db.collection('recruiter_configs');

    const recruiterId = 'default_recruiter';

    await collection.updateOne(
      { recruiterId },
      {
        $set: {
          prompts: customPrompts,
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    return NextResponse.json({ prompts: customPrompts });
  } catch (error) {
    console.error('Failed to generate prompts:', error);
    return NextResponse.json({ error: 'Failed to generate prompts' }, { status: 500 });
  } finally {
    await client.close();
  }
}

async function generateInterviewPrompt(basePrompt: string, questions: CustomQuestions): Promise<string> {
  const customSections = [];

  // Build custom question instructions for each stage
  if (questions.greet.length > 0) {
    customSections.push(`**STATE: greet**
Substates: greet_intro, greet_background, greet_expectations, greet_tech_stack
- greet_intro: ${questions.greet[0] || 'Welcome warmly, introduce yourself, ask about their current role'}
- greet_background: ${questions.greet[1] || 'Ask about their experience level and career goals'}
- greet_expectations: ${questions.greet[2] || 'Ask what they hope to achieve from this interview'}
- greet_tech_stack: ${questions.greet[3] || 'Ask about preferred programming languages/tech stack'}
- After completing all substates, set state to "resume", substate to "resume_overview"`);
  }

  if (questions.resume.length > 0) {
    customSections.push(`**STATE: resume**
Substates: resume_overview, resume_projects, resume_challenges, resume_lessons
- resume_overview: ${questions.resume[0] || 'Ask about their overall experience and key skills from resume'}
- resume_projects: ${questions.resume[1] || 'Ask about their most significant project'}
- resume_challenges: ${questions.resume[2] || 'Ask about technical challenges faced'}
- resume_lessons: ${questions.resume[3] || 'Ask about lessons learned'}
- Focus on resume content provided in context. If they ask for hints, provide gentle guidance.
- After completing all substates, set state to "cs", substate to "cs_intro"`);
  }

  if (questions.cs.length > 0) {
    customSections.push(`**STATE: cs**
Substates: cs_intro, cs_databases, cs_systems, cs_algorithms
- cs_intro: ${questions.cs[0] || 'Introduce CS fundamentals'}
- cs_databases: ${questions.cs[1] || 'Ask about database concepts'}
- cs_systems: ${questions.cs[2] || 'Ask about OS/networking'}
- cs_algorithms: ${questions.cs[3] || 'Ask about algorithms/DS'}
- **CRITICAL:** If user gives negative responses ("I don't know", "I'm not familiar"), IMMEDIATELY set state to "behave", substate to "behave_intro"
- Provide hints if asked: start high-level, then specific
- After completing all substates or on poor answers, set state to "behave", substate to "behave_intro"`);
  }

  if (questions.behave.length > 0) {
    customSections.push(`**STATE: behave**
Substates: behave_intro, behave_teamwork, behave_conflict, behave_leadership
- behave_intro: ${questions.behave[0] || 'Introduce behavioral questions'}
- behave_teamwork: ${questions.behave[1] || 'Ask about teamwork experiences'}
- behave_conflict: ${questions.behave[2] || 'Ask about conflict resolution'}
- behave_leadership: ${questions.behave[3] || 'Ask about leadership'}
- Use STAR method, provide hints if needed
- After completing all substates, set state to "wrap_up", substate to "wrap_feedback"`);
  }

  if (questions.wrap_up.length > 0) {
    customSections.push(`**STATE: wrap_up**
Substates: wrap_feedback, wrap_strengths, wrap_improvements, wrap_final
- wrap_feedback: ${questions.wrap_up[0] || 'Ask for overall feedback'}
- wrap_strengths: ${questions.wrap_up[1] || 'Highlight their strengths'}
- wrap_improvements: ${questions.wrap_up[2] || 'Discuss areas for improvement'}
- wrap_final: ${questions.wrap_up[3] || 'Provide final advice and mention coding challenge'}
- After completing all substates, set state to "end", substate to "completed"`);
  }

  // Replace the stage instructions in the base prompt
  let customPrompt = basePrompt;

  // Use AI to generate the complete prompt with custom questions integrated
  const systemPrompt = `You are a prompt engineering expert. Take the base interview prompt and integrate the custom questions provided for each stage. Maintain the exact same format and structure as the base prompt, but replace the default questions with the custom ones where provided. If no custom questions are provided for a stage, keep the original questions.

Base Prompt:
${basePrompt}

Custom Questions by Stage:
${Object.entries(questions).map(([stage, qList]) =>
  `${stage}: ${qList.length > 0 ? qList.join(' | ') : 'Use default'}`
).join('\n')}

Generate a complete interview prompt that follows the exact same format but incorporates the custom questions naturally.`;

  const completion = await groqClient.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the customized interview prompt.' }
    ],
    temperature: 0.3,
    max_tokens: 4000
  });

  return completion.choices[0].message.content || basePrompt;
}

async function generateCodingPrompt(basePrompt: string, customCodingQuestions: string[]): Promise<string> {
  if (customCodingQuestions.length === 0) {
    return basePrompt;
  }

  // For coding, we need to modify the prompt to use specific problems instead of random generation
  const customCodingText = customCodingQuestions.join('\n');

  const systemPrompt = `You are a prompt engineering expert. Modify the base coding curator prompt to generate problems based on the custom requirements provided, rather than random generation.

Base Prompt:
${basePrompt}

Custom Coding Requirements:
${customCodingText}

Modify the prompt so that instead of generating random problems with tags/difficulties, it generates problems that match the custom requirements. Keep the same output format and structure.`;

  const completion = await groqClient.chat.completions.create({
    model: 'openai/gpt-oss-120b',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: 'Generate the customized coding curator prompt.' }
    ],
    temperature: 0.3,
    max_tokens: 3000
  });

  return completion.choices[0].message.content || basePrompt;
}