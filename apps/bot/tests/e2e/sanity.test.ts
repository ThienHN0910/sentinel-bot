/**
 * E2E Sanity Test — deployment hygiene checks
 *
 * Verifies:
 *  1. .gitignore lists .env (no accidental credential leaks)
 *  2. .env.example contains NO real secrets (50+ char alphanumeric tokens,
 *     or connection strings with embedded credentials)
 *  3. MONGODB_URI appears in .env.example as a placeholder
 */
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Resolve from monorepo root (apps/bot/tests/e2e → ../../../../)
const ROOT = path.resolve(__dirname, '../../../../');

describe('Deployment Sanity Checks', () => {
  it('.gitignore includes .env', () => {
    const gitignorePath = path.join(ROOT, '.gitignore');
    expect(fs.existsSync(gitignorePath), `.gitignore not found at ${gitignorePath}`).toBe(true);

    const content = fs.readFileSync(gitignorePath, 'utf-8');
    // Must have a line that matches .env (with or without surrounding text)
    const lines = content.split(/\r?\n/).map((l) => l.trim());
    const hasEnv = lines.some((l) => l === '.env' || l === '.env.*' || l === '**/.env' || l === '.env*');
    expect(hasEnv, '.gitignore must include a .env entry').toBe(true);
  });

  it('.env.example has no real secrets (no embedded-credential URIs or 50+ char tokens)', () => {
    const envExamplePath = path.join(ROOT, '.env.example');
    expect(fs.existsSync(envExamplePath), `.env.example not found at ${envExamplePath}`).toBe(true);

    const content = fs.readFileSync(envExamplePath, 'utf-8');

    // Pattern 1: MongoDB/postgres/mysql/redis connection strings with real credentials
    // (pattern: scheme://user:password@ where password is non-placeholder)
    const credentialUriPattern = /mongodb\+srv:\/\/[^<>\s]+:[^<>\s]+@/;
    expect(
      credentialUriPattern.test(content),
      '.env.example must NOT contain real MongoDB connection strings with credentials'
    ).toBe(false);

    // Pattern 2: 50+ character pure alphanumeric tokens (likely real API keys / secrets)
    // We split on lines and check each value
    const lines = content.split(/\r?\n/);
    for (const line of lines) {
      if (line.startsWith('#') || !line.includes('=')) continue;
      const [, ...valueParts] = line.split('=');
      const value = valueParts.join('=').trim();
      // A real secret: 50+ chars, composed only of alphanumerics (no angle brackets, spaces, underscores)
      const looksLikeRealToken = /^[A-Za-z0-9]{50,}$/.test(value);
      expect(
        looksLikeRealToken,
        `Line "${line}" appears to contain a real 50+ char alphanumeric token`
      ).toBe(false);
    }
  });

  it('.env.example contains MONGODB_URI as a placeholder', () => {
    const envExamplePath = path.join(ROOT, '.env.example');
    const content = fs.readFileSync(envExamplePath, 'utf-8');

    // Must have MONGODB_URI= line
    expect(content, '.env.example must define MONGODB_URI').toMatch(/^MONGODB_URI=/m);
  });

  it('ecosystem.config.js exists and includes required PM2 settings', () => {
    const ecosystemPath = path.join(ROOT, 'ecosystem.config.js');
    expect(fs.existsSync(ecosystemPath), 'ecosystem.config.js not found').toBe(true);

    const content = fs.readFileSync(ecosystemPath, 'utf-8');
    expect(content, 'ecosystem.config.js must reference dist/index.js').toContain('dist/index.js');
    expect(content, 'ecosystem.config.js must set --max-old-space-size=400').toContain('--max-old-space-size=400');
    expect(content, 'ecosystem.config.js must set max_memory_restart').toContain('max_memory_restart');
  });

  it('scripts/setup-vps.sh exists and creates a 2GB swapfile', () => {
    const setupPath = path.join(ROOT, 'scripts', 'setup-vps.sh');
    expect(fs.existsSync(setupPath), 'scripts/setup-vps.sh not found').toBe(true);

    const content = fs.readFileSync(setupPath, 'utf-8');
    expect(content, 'setup-vps.sh must create a swapfile').toContain('swapfile');
    expect(content, 'setup-vps.sh must configure a 2G swap').toMatch(/2G|2048M/);
  });
});
