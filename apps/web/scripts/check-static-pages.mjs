import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const domain = 'https://sentinel-dashboard.thienhn.io.vn';
const pages = [
  ['index.html', '/', 'Một cộng đồng', 'index,follow'],
  ['commands.html', '/commands', '/game baucua', 'index,follow'],
  ['privacy.html', '/privacy', 'Chính sách', 'index,follow'],
  ['terms.html', '/terms', 'Điều khoản', 'index,follow'],
  ['dashboard.html', '/dashboard', 'Loading live data', 'noindex,follow'],
  ['wheel.html', '/wheel', 'Vòng quay', 'noindex,follow'],
  ['games/new.html', '/games/new', 'Chơi cùng server', 'noindex,follow']
];

for (const [file, path, content, robots] of pages) {
  const html = readFileSync(resolve(root, 'dist', file), 'utf8');
  const required = [`rel="canonical" href="${domain}${path}"`, `name="robots" content="${robots}"`, content, '<title>'];
  for (const needle of required) {
    if (!html.includes(needle)) throw new Error(`${file} missing ${needle}`);
  }
}

const icon = readFileSync(resolve(root, 'public', 'sentinel-icon.png'));
if (icon.readUInt32BE(16) !== 1024 || icon.readUInt32BE(20) !== 1024 || icon.byteLength > 10_000_000) {
  throw new Error('Discord icon must be 1024x1024 and under 10MB');
}
const config = JSON.parse(readFileSync(resolve(root, 'vercel.json'), 'utf8'));
if (config.cleanUrls !== true) throw new Error('Vercel must serve clean legal URLs');
if (!config.rewrites?.some(rule => rule.source === '/games/:sessionId' && rule.destination === '/')) {
  throw new Error('Vercel must serve direct game links with the SPA shell');
}
console.log(`Verified ${pages.length} static pages, canonical URLs, robots directives, and Discord icon.`);
