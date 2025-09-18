import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

export async function elevenlabsSynthesizeMp3(text: string): Promise<Buffer> {
  if (!text || !text.trim()) throw new Error('No text provided to ElevenLabs TTS');
  const apiKey = process.env.ELEVEN_LABS_API_KEY;
  if (!apiKey) throw new Error('Missing ELEVEN_LABS_API_KEY in env');
  // Use provided default voice id unless overridden in env
  const voiceId = process.env.ELEVENLABS_VOICE_ID || 'CwhRBWXzGAHq8TQ4Fs17';
  const stability = parseFloat(process.env.ELEVENLABS_STABILITY || '0.25');
  const similarityBoost = parseFloat(process.env.ELEVENLABS_SIMILARITY || '0.75');

  const client = new ElevenLabsClient({ apiKey });

  // Log chosen voice and tuning so you can tweak via env vars
  console.log('[ElevenLabsTTS] Using voice:', voiceId, 'stability:', stability, 'similarityBoost:', similarityBoost);

  const result = await client.textToSpeech.convert(voiceId, {
    text: text.trim(),
    modelId: 'eleven_flash_v2_5',
    outputFormat: 'mp3_44100_128',
    // voice_settings is supported by ElevenLabs to tune naturalness and similarity
    voice_settings: {
      stability: isNaN(stability) ? 0.25 : stability,
      similarity_boost: isNaN(similarityBoost) ? 0.75 : similarityBoost,
    }
  } as any);

  const toBuffer = async (val: any): Promise<Buffer> => {
    if (!val) throw new Error('Empty ElevenLabs TTS response');
    if (Buffer.isBuffer(val)) return val;
    if (val instanceof Uint8Array) return Buffer.from(val);
    if (val instanceof ArrayBuffer) return Buffer.from(new Uint8Array(val));
    if (typeof val === 'object' && typeof val.getReader === 'function') {
      const reader = val.getReader();
      const chunks: Uint8Array[] = [];
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) chunks.push(value);
      }
      return Buffer.concat(chunks.map((c) => Buffer.from(c)));
    }
    if (typeof val === 'object' && typeof val.on === 'function') {
      const stream: NodeJS.ReadableStream = val;
      const chunks: Buffer[] = [];
      await new Promise<void>((resolve, reject) => {
        stream.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        stream.on('end', () => resolve());
        stream.on('error', reject);
      });
      return Buffer.concat(chunks);
    }
    if (typeof val === 'object' && val.audio) return toBuffer(val.audio);
    throw new Error('Unsupported ElevenLabs TTS return type');
  };

  return await toBuffer(result);
}

// Export a unified name used by server agent
export const textToSpeechBuffer = elevenlabsSynthesizeMp3;
