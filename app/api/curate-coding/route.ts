import { NextResponse } from 'next/server';
import codingCurator from '../../../lib/services/coding_curator';
import { getJSON, setJSON } from '../../../lib/utils/redisSession';

export async function GET() {
  try {
    const CACHE_KEY = 'curator:latest';
    // Try cache first
    const cached = await getJSON<{ problems: unknown[] }>(CACHE_KEY);
    if (cached && Array.isArray(cached.problems) && cached.problems.length > 0) {
      return NextResponse.json({ problems: cached.problems, cached: true });
    }

    const result = await codingCurator.curate();
    // Cache for 6 hours (21600 seconds)
    await setJSON(CACHE_KEY, { problems: result.problems }, 21600);
    return NextResponse.json({ problems: result.problems, cached: false });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Curate coding error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}