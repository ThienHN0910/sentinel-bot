import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PassThrough, Readable } from 'stream';
import { GoogleTtsProvider } from '../src/services/voice/tts/googleProvider';
import { EdgeTtsProvider } from '../src/services/voice/tts/edgeProvider';
import { ElevenLabsProvider } from '../src/services/voice/tts/elevenLabsProvider';
import { TtsManager, getVietnameseTtsStream } from '../src/services/voice/tts/ttsManager';
import https from 'https';

describe('TTS Providers & TtsManager', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('GoogleTtsProvider', () => {
    it('streams audio chunks from Google translate TTS', async () => {
      const fakeIncoming = new PassThrough();
      vi.spyOn(https, 'get').mockImplementation((url: any, cb: any) => {
        expect(url).toContain('https://translate.google.com/translate_tts');
        if (typeof cb === 'function') cb(fakeIncoming as any);
        return { on: vi.fn().mockReturnThis() } as any;
      });

      const provider = new GoogleTtsProvider();
      const stream = provider.stream('Xin chào');
      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(c));

      fakeIncoming.write(Buffer.from('google-audio-data'));
      fakeIncoming.end();

      await new Promise((resolve) => stream.on('end', resolve));
      expect(Buffer.concat(chunks).toString()).toBe('google-audio-data');
    });
  });

  describe('ElevenLabsProvider', () => {
    it('throws when ELEVENLABS_API_KEY is not set', async () => {
      delete process.env.ELEVENLABS_API_KEY;
      const provider = new ElevenLabsProvider();
      await expect(provider.stream('Hello')).rejects.toThrow('ELEVENLABS_API_KEY is not set');
    });

    it('makes POST request to ElevenLabs stream API when key is present', async () => {
      process.env.ELEVENLABS_API_KEY = 'test-eleven-key';
      const fakeIncoming = new PassThrough();
      const mockReq = {
        on: vi.fn().mockReturnThis(),
        write: vi.fn(),
        end: vi.fn()
      };

      vi.spyOn(https, 'request').mockImplementation((options: any, cb: any) => {
        expect(options.hostname).toBe('api.elevenlabs.io');
        expect(options.headers['xi-api-key']).toBe('test-eleven-key');
        if (typeof cb === 'function') cb(fakeIncoming as any);
        return mockReq as any;
      });

      const provider = new ElevenLabsProvider();
      const stream = await provider.stream('Hello Eleven');
      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(c));

      fakeIncoming.write(Buffer.from('eleven-stream-audio'));
      fakeIncoming.end();

      await new Promise((resolve) => stream.on('end', resolve));
      expect(Buffer.concat(chunks).toString()).toBe('eleven-stream-audio');
      delete process.env.ELEVENLABS_API_KEY;
    });
  });

  describe('EdgeTtsProvider', () => {
    it('initializes MsEdgeTTS and calls toStream with anime pitch and rate', async () => {
      const provider = new EdgeTtsProvider();
      const fakeAudioStream = new PassThrough();
      const setMetadataSpy = vi.fn().mockResolvedValue(undefined);
      const toStreamSpy = vi.fn().mockReturnValue({ audioStream: fakeAudioStream });

      (provider as any).tts = {
        setMetadata: setMetadataSpy,
        toStream: toStreamSpy
      };

      const stream = await provider.stream('Konbanwa');
      expect(setMetadataSpy).toHaveBeenCalled();
      expect(toStreamSpy).toHaveBeenCalledWith('Konbanwa', expect.objectContaining({
        pitch: expect.any(String),
        rate: expect.any(String)
      }));

      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(c));
      fakeAudioStream.write(Buffer.from('edge-audio-chunk'));
      fakeAudioStream.end();

      await new Promise((resolve) => stream.on('end', resolve));
      expect(Buffer.concat(chunks).toString()).toBe('edge-audio-chunk');
    });
  });

  describe('TtsManager', () => {
    it('falls back to Edge and Google if ElevenLabs fails', async () => {
      process.env.TTS_PROVIDER = 'elevenlabs';
      delete process.env.ELEVENLABS_API_KEY;

      const edgeMock = new PassThrough();
      const edgeProviderMock = {
        name: 'edge',
        stream: vi.fn().mockRejectedValue(new Error('Edge socket failed'))
      };
      const googleMock = new PassThrough();
      const googleProviderMock = {
        name: 'google',
        stream: vi.fn().mockReturnValue(googleMock)
      };

      const manager = new TtsManager({
        elevenlabs: new ElevenLabsProvider(),
        edge: edgeProviderMock as any,
        google: googleProviderMock as any
      });

      const stream = await manager.getStream('Fallback test');
      expect(googleProviderMock.stream).toHaveBeenCalled();

      const chunks: Buffer[] = [];
      stream.on('data', (c) => chunks.push(c));
      googleMock.write(Buffer.from('google-fallback-audio'));
      googleMock.end();

      await new Promise((resolve) => stream.on('end', resolve));
      expect(Buffer.concat(chunks).toString()).toBe('google-fallback-audio');
      delete process.env.TTS_PROVIDER;
    });

    it('getVietnameseTtsStream returns a valid PassThrough stream', async () => {
      const stream = getVietnameseTtsStream('Xin chào');
      expect(stream).toBeInstanceOf(PassThrough);
      expect(typeof stream.pipe).toBe('function');
    });
  });
});
