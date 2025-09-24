import { NextResponse } from 'next/server';
import { runOnOneCompiler } from '@/lib/services/onecompiler_executor';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const payload = {
      language: body.language || body.lang || 'python',
      stdin: body.stdin || body.stdin_text || body.stdin_textarea || '',
      files: body.files,
      source_code: body.source_code || body.source || body.sourceCode || undefined
    };

    const result = await runOnOneCompiler(payload as any);
    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json({ status: 'failed', error: err?.message || String(err) }, { status: 500 });
  }
}
