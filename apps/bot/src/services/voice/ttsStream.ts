import https from 'https';
import { Readable } from 'stream';

export function getVietnameseTtsStream(text: string): Readable {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob`;
  const readable = new Readable({ read() {} });

  https
    .get(url, (res) => {
      res.on('data', (chunk) => readable.push(chunk));
      res.on('end', () => readable.push(null));
    })
    .on('error', (err) => {
      readable.destroy(err);
    });

  return readable;
}
