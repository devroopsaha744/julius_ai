declare module '@elevenlabs/elevenlabs-js' {
  export class ElevenLabsClient {
    constructor(opts: { apiKey: string });
    textToSpeech: {
      convert(voiceId: string, opts: any): Promise<any>;
    };
  }
  export default ElevenLabsClient;
}
