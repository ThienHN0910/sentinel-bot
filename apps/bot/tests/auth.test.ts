import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFastifyServer } from '../src/api/server';
import { AuthStateModel, type AuthState } from '../src/models/AuthState';
import { AuthSessionModel, type AuthSession } from '../src/models/AuthSession';

const states = new Map<string, AuthState>();
const sessions = new Map<string, AuthSession>();

function fakeDatabase() {
  vi.spyOn(AuthStateModel, 'create').mockImplementation((async (value: AuthState) => {
    states.set(value.stateHash, value);
    return value;
  }) as any);
  vi.spyOn(AuthStateModel, 'findOneAndDelete').mockImplementation(((filter: any) => ({ lean: async () => {
    const value = states.get(filter.stateHash);
    if (!value || value.expiresAt <= filter.expiresAt.$gt) return null;
    states.delete(filter.stateHash);
    return value;
  } })) as any);
  vi.spyOn(AuthSessionModel, 'create').mockImplementation((async (value: AuthSession) => {
    sessions.set(value.tokenHash, value);
    return value;
  }) as any);
  vi.spyOn(AuthSessionModel, 'findOne').mockImplementation(((filter: any) => ({ lean: async () => {
    const value = sessions.get(filter.tokenHash);
    return value && value.expiresAt > filter.expiresAt.$gt ? value : null;
  } })) as any);
  vi.spyOn(AuthSessionModel, 'deleteOne').mockImplementation((async (filter: any) => {
    const deletedCount = sessions.delete(filter.tokenHash) ? 1 : 0;
    return { deletedCount };
  }) as any);
}

function fakeDiscord() {
  vi.stubGlobal('fetch', vi.fn(async (input: string) => {
    if (input.endsWith('/oauth2/token')) return new Response(JSON.stringify({ access_token: 'private-access-token', token_type: 'Bearer', expires_in: 604800 }), { status: 200 });
    if (input.endsWith('/users/@me/guilds')) return new Response(JSON.stringify([{ id: 'guild-1', owner: true, permissions: '32' }]), { status: 200 });
    if (input.endsWith('/users/@me')) return new Response(JSON.stringify({ id: 'user-1', username: 'Alice', avatar: null }), { status: 200 });
    throw new Error(`Unexpected Discord URL: ${input}`);
  }));
}

function stateFrom(response: { headers: Record<string, any> }) {
  return new URL(response.headers.location as string).searchParams.get('state') as string;
}

function stateCookieFrom(response: { headers: Record<string, any> }) {
  return String(response.headers['set-cookie']).split(';')[0];
}

describe('Discord OAuth routes', () => {
  let app: ReturnType<typeof buildFastifyServer>;
  beforeAll(async () => {
    vi.stubEnv('DISCORD_CLIENT_ID', '1553723429423808572');
    vi.stubEnv('DISCORD_CLIENT_SECRET', 'test-client-secret');
    vi.stubEnv('DISCORD_REDIRECT_URI', 'https://sentinel-bot.thienhn.io.vn/api/auth/discord/callback');
    vi.stubEnv('FRONTEND_URL', 'https://sentinel-dashboard.thienhn.io.vn');
    vi.stubEnv('SESSION_SECRET', 'test-session-secret-with-at-least-32-bytes');
    app = buildFastifyServer();
    await app.ready();
  });
  afterAll(async () => { await app.close(); vi.unstubAllEnvs(); });
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    states.clear();
    sessions.clear();
    fakeDatabase();
    fakeDiscord();
  });

  it('starts login with identify/guilds scopes and a random state', async () => {
    const response = await app.inject('/api/auth/discord/start');
    expect(response.statusCode).toBe(302);
    const url = new URL(response.headers.location as string);
    expect(url.origin).toBe('https://discord.com');
    expect(url.searchParams.get('scope')).toBe('identify guilds');
    expect(url.searchParams.get('state')).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(stateCookieFrom(response)).toMatch(/^sentinel_oauth_state=[A-Za-z0-9_-]+$/);
  });

  it('rejects a callback without a valid one-time state', async () => {
    const response = await app.inject('/api/auth/discord/callback?code=abc&state=invalid');
    expect(response.statusCode).toBe(400);
    expect(String(response.headers['set-cookie'])).not.toContain('sentinel_sid=');
  });

  it('expires state after ten minutes and never creates a session for it', async () => {
    const start = await app.inject('/api/auth/discord/start');
    expect([...states.values()][0].expiresAt.getTime() - Date.now()).toBeGreaterThan(590_000);
    states.values().next().value!.expiresAt = new Date(Date.now() - 1);
    const response = await app.inject({ url: `/api/auth/discord/callback?code=abc&state=${stateFrom(start)}`, headers: { cookie: stateCookieFrom(start) } });
    expect(response.statusCode).toBe(400);
    expect(sessions.size).toBe(0);
  });

  it('consumes state once and does not create a session after token exchange fails', async () => {
    const start = await app.inject('/api/auth/discord/start');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('denied', { status: 400 })));
    const url = `/api/auth/discord/callback?code=bad&state=${stateFrom(start)}`;
    const failed = await app.inject({ url, headers: { cookie: stateCookieFrom(start) } });
    expect(failed.statusCode).toBe(502);
    expect(String(failed.headers['set-cookie'])).not.toContain('sentinel_sid=');
    expect(sessions.size).toBe(0);
    expect((await app.inject({ url, headers: { cookie: stateCookieFrom(start) } })).statusCode).toBe(400);
  });

  it('creates a secure seven-day cookie and exposes identity without Discord tokens', async () => {
    const start = await app.inject('/api/auth/discord/start');
    const callback = await app.inject({ url: `/api/auth/discord/callback?code=valid&state=${stateFrom(start)}`, headers: { cookie: stateCookieFrom(start) } });
    expect(callback.statusCode).toBe(302);
    const setCookie = String(callback.headers['set-cookie']);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('Secure');
    expect(setCookie).toContain('SameSite=Lax');
    expect(setCookie).toContain('Max-Age=604800');
    expect(setCookie).not.toContain('Domain=');
    const cookie = setCookie.split(';')[0];
    const me = await app.inject({ url: '/api/auth/me', headers: { cookie } });
    expect(me.statusCode).toBe(200);
    expect(me.json()).toMatchObject({ user: { id: 'user-1', username: 'Alice' } });
    expect(me.json().csrfToken).toMatch(/^[A-Za-z0-9_-]{20,}$/);
    expect(me.body).not.toContain('private-access-token');
    expect((await app.inject({ url: `/api/auth/discord/callback?code=valid&state=${stateFrom(start)}`, headers: { cookie: stateCookieFrom(start) } })).statusCode).toBe(400);
  });

  it('rejects expired sessions and revokes a valid session on logout', async () => {
    const start = await app.inject('/api/auth/discord/start');
    const callback = await app.inject({ url: `/api/auth/discord/callback?code=valid&state=${stateFrom(start)}`, headers: { cookie: stateCookieFrom(start) } });
    const cookie = String(callback.headers['set-cookie']).split(';')[0];
    const me = await app.inject({ url: '/api/auth/me', headers: { cookie } });
    const csrf = me.json().csrfToken as string;
    const origin = 'https://sentinel-dashboard.thienhn.io.vn';
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie, 'x-csrf-token': csrf } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie, origin, 'x-csrf-token': 'wrong' } })).statusCode).toBe(403);
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { cookie, origin, 'x-csrf-token': csrf } });
    expect(logout.statusCode).toBe(204);
    expect(String(logout.headers['set-cookie'])).toContain('Expires=Thu, 01 Jan 1970');
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie } })).statusCode).toBe(401);

    const nextStart = await app.inject('/api/auth/discord/start');
    const nextCallback = await app.inject({ url: `/api/auth/discord/callback?code=valid&state=${stateFrom(nextStart)}`, headers: { cookie: stateCookieFrom(nextStart) } });
    const nextCookie = String(nextCallback.headers['set-cookie']).split(';')[0];
    sessions.values().next().value!.expiresAt = new Date(Date.now() - 1);
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: nextCookie } })).statusCode).toBe(401);
  });
});
