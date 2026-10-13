import { Readable } from 'stream';

export interface TtsOptions {
  voice?: string;
  pitch?: string;
  rate?: string;
}

export interface TtsProvider {
  readonly name: string;
  stream(text: string, options?: TtsOptions): Promise<Readable> | Readable;
}
