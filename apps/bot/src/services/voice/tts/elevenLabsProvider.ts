import https from 'https';
import { Readable, PassThrough } from 'stream';
import { TtsOptions, TtsProvider } from './types';

export class ElevenLabsProvider implements TtsProvider {
  public readonly name = 'elevenlabs';

  public async stream(text: string, options?: TtsOptions): Promise<Readable> {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY is not set');
    }

    const voiceId = options?.voice || process.env.ELEVENLABS_VOICE_ID || '21m00Tcm4TlvDq8ikWAM';
    const payload = JSON.stringify({
      text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.8,
        style: 0.5,
        use_speaker_boost: true
      }
    });

    const passThrough = new PassThrough();

    const req = https.request(
      {
        hostname: 'api.elevenlabs.io',
        path: `/v1/text-to-speech/${encodeURIComponent(voiceId)}/stream`,
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg',
          'Content-Length': Buffer.byteLength(payload)
        }
      },
      (res) => {
        if (res.statusCode && res.statusCode >= 400) {
          let errBody = '';
          res.on('data', (c) => (errBody += c));
          res.on('end', () => {
            passThrough.destroy(new Error(`ElevenLabs API error (${res.statusCode}): ${errBody}`));
          });
          return;
        }

        res.pipe(passThrough);
      }
    );

    req.on('error', (err) => {
      passThrough.destroy(err);
    });

    req.write(payload);
    req.end();

    return passThrough;
  }
}
