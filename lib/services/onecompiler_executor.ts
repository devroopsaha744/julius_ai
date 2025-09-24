// Minimal OneCompiler executor
export interface OneCompilerFile { name: string; content: string }
export interface OneCompilerRunRequest { language: string; stdin?: string; files?: OneCompilerFile[]; source_code?: string }
export interface OneCompilerRunResponse { stdout?: string | null; stderr?: string | null; exception?: string | null; executionTime?: number | null; limitPerMonthRemaining?: number | null; status?: string; error?: string | null }

const RAPIDAPI_HOST = 'onecompiler-apis.p.rapidapi.com';

export async function runOnOneCompiler(req: OneCompilerRunRequest): Promise<OneCompilerRunResponse> {
  const accessToken = process.env.ONECOMPILER_ACCESS_TOKEN || process.env.ONECOMPILER_KEY;
  const rapidApiKey = process.env.ONECOMPILER_RAPIDAPI_KEY || process.env.JUDGE0_RAPIDAPI_KEY;

  const payload: any = { language: req.language || 'python' };
  if (req.stdin) payload.stdin = req.stdin;
  if (req.files && req.files.length) payload.files = req.files;
  else if (req.source_code) payload.files = [{ name: `main.${req.language === 'python' ? 'py' : 'txt'}`, content: req.source_code }];

  if (accessToken) {
    const url = `https://onecompiler.com/api/v1/run?access_token=${encodeURIComponent(accessToken)}`;
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    if (!res.ok) throw new Error(`OneCompiler error ${res.status}`);
    return await res.json();
  }

  if (!rapidApiKey) throw new Error('OneCompiler access token or RapidAPI key not configured');

  const rapidUrl = `https://${RAPIDAPI_HOST}/api/v1/run`;
  const res = await fetch(rapidUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-rapidapi-host': RAPIDAPI_HOST, 'x-rapidapi-key': rapidApiKey }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`OneCompiler RapidAPI error ${res.status} ${t}`);
  }
  return await res.json();
}

export default { runOnOneCompiler };
