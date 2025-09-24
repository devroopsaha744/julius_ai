import { NextResponse } from 'next/server';
import codingCurator from '../../../../../lib/services/coding_curator';
import { getJSON, setJSON } from '../../../../../lib/utils/redisSession';

export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const id = params.id;
  try {
    const CACHE_KEY = 'curator:latest';
    let cached = await getJSON<{ problems: any[] }>(CACHE_KEY);
    if (!cached) {
      const result = await codingCurator.curate();
      cached = { problems: result.problems };
      await setJSON(CACHE_KEY, cached, 21600);
    }

    const problem = cached.problems.find(p => p.id === id);
    if (!problem) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }
    return NextResponse.json({ problem });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Curate single problem error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
