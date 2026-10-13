import { PassThrough, Readable } from 'stream';
import { TtsOptions, TtsProvider } from './types';
import { EdgeTtsProvider } from './edgeProvider';
import { ElevenLabsProvider } from './elevenLabsProvider';
import { GoogleTtsProvider } from './googleProvider';

export class TtsManager {
  private providers: Record<string, TtsProvider>;

  constructor(customProviders?: Record<string, TtsProvider>) {
    this.providers = customProviders || {
      edge: new EdgeTtsProvider(),
      elevenlabs: new ElevenLabsProvider(),
      google: new GoogleTtsProvider()
    };
  }

  public async getStream(text: string, options?: TtsOptions & { provider?: string }): Promise<Readable> {
    const configuredProvider = options?.provider || process.env.TTS_PROVIDER || 'edge';

    const tryProvider = async (name: string): Promise<Readable | null> => {
      const provider = this.providers[name];
      if (!provider) return null;
      try {
        const stream = await provider.stream(text, options);
        return stream;
      } catch (err) {
        console.warn(`[TTS] Provider '${name}' failed, attempting fallback:`, (err as any)?.message || err);
        return null;
      }
    };

    // 1. Try selected provider
    let result = await tryProvider(configuredProvider);
    if (result) return result;

    // 2. Fallback to Edge if not already tried
    if (configuredProvider !== 'edge') {
      result = await tryProvider('edge');
      if (result) return result;
    }

    // 3. Fallback to Google if not already tried
    if (configuredProvider !== 'google') {
      result = await tryProvider('google');
      if (result) return result;
    }

    // 4. Last resort: direct Google fallback
    const fallback = this.providers['google'] || new GoogleTtsProvider();
    return fallback.stream(text, options);
  }
}

export const defaultTtsManager = new TtsManager();

export function getVietnameseTtsStream(text: string, options?: TtsOptions & { provider?: string }): Readable {
  const providerName = options?.provider || process.env.TTS_PROVIDER;
  if (providerName === 'google') {
    return new GoogleTtsProvider().stream(text);
  }

  const passThrough = new PassThrough();

  defaultTtsManager
    .getStream(text, options)
    .then((readable) => {
      readable.on('error', (err) => passThrough.destroy(err));
      readable.pipe(passThrough);
    })
    .catch((err) => {
      passThrough.destroy(err);
    });

  return passThrough;
}
