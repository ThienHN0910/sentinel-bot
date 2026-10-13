import { Readable } from 'stream';
import { MsEdgeTTS, OUTPUT_FORMAT } from 'msedge-tts';
import { TtsOptions, TtsProvider } from './types';

export class EdgeTtsProvider implements TtsProvider {
  public readonly name = 'edge';
  private tts: MsEdgeTTS;

  constructor() {
    this.tts = new MsEdgeTTS();
  }

  public async stream(text: string, options?: TtsOptions): Promise<Readable> {
    const voice = options?.voice || process.env.EDGE_TTS_VOICE || 'vi-VN-HoaiMyNeural';
    const pitch = options?.pitch || process.env.EDGE_TTS_PITCH || '+10Hz';
    const rate = options?.rate || process.env.EDGE_TTS_RATE || '+5%';

    await this.tts.setMetadata(voice, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
    const result = this.tts.toStream(text, { pitch, rate });
    return result.audioStream;
  }
}
