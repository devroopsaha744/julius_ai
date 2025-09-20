// Use a guarded require so TypeScript/tsc won't fail if the SDK isn't installed in the environment.
let createClient: any;
try {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, @typescript-eslint/no-unsafe-assignment
  ({ createClient } = require('@deepgram/sdk'));
} catch (err) {
  // leave createClient undefined; we'll throw at runtime if it's needed
  createClient = undefined;
}

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY || '';

if (!DEEPGRAM_API_KEY) {
  console.warn('Deepgram API key not set in DEEPGRAM_API_KEY');
}

export async function textToSpeechBuffer(text: string, opts?: { model?: string; sampleRate?: number; timeoutMs?: number }): Promise<Buffer> {
  const model = opts?.model || 'aura-2-thalia-en';
  const sample_rate = opts?.sampleRate || 48000;
  const timeoutMs = opts?.timeoutMs || 10000;

  if (!createClient) {
    throw new Error("Missing dependency '@deepgram/sdk'. Please install it with 'npm install @deepgram/sdk'");
  }
  const deepgram = createClient(DEEPGRAM_API_KEY);

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let finished = false;

    try {
      const connection = deepgram.speak.live({
        model,
        encoding: 'linear16',
        sample_rate
      });

      const onError = (err: any) => {
        if (!finished) {
          finished = true;
          reject(err instanceof Error ? err : new Error(String(err)));
        }
      };

      const onClose = () => {
        if (!finished) {
          finished = true;
          try {
            const out = Buffer.concat(chunks);
            resolve(out);
          } catch (err) {
            reject(err);
          }
        }
      };

      const onAudio = (data: any) => {
        try {
          // Deepgram may emit either Buffer or ArrayBuffer-like data
          const buf = Buffer.isBuffer(data) ? data : Buffer.from(data);
          chunks.push(buf);
        } catch (err) {
          // ignore chunk parse errors
        }
      };

      connection.on('error', onError);
      connection.on('audio', onAudio);
      connection.on('close', onClose);
      connection.on('open', () => {
        try {
          connection.sendText(text);
          // flush/finish depending on SDK
          if (typeof connection.flush === 'function') connection.flush();
          // set a safety timeout to finish the connection
          setTimeout(() => {
            try { if (typeof connection.finish === 'function') connection.finish(); } catch(e){}
          }, 500);
        } catch (err) {
          onError(err);
        }
      });

      // safety timeout
      const t = setTimeout(() => {
        if (!finished) {
          finished = true;
          try {
            const out = Buffer.concat(chunks);
            resolve(out);
          } catch (err) {
            reject(err);
          }
        }
      }, timeoutMs);

      // clear timeout on finish
      const cleanup = () => { clearTimeout(t); };
      connection.on('close', cleanup);
      connection.on('error', cleanup);

    } catch (err) {
      reject(err);
    }
  });
}

export default { textToSpeechBuffer };
