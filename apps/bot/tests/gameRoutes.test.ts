import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Client } from 'discord.js';
import type { GameState } from '@sentinel/shared';
import { buildFastifyServer } from '../src/api/server';
import { GameSessionModel } from '../src/models/GameSession';
import { AuthSessionModel } from '../src/models/AuthSession';

const guildId = '123456789012345678';
const creatorId = '234567890123456789';
const opponentId = '345678901234567890';
const sessionId = 'abcdefghijklmnopqrstu';
const cookie = `sentinel_sid=${'a'.repeat(43)}`;
const origin = 'https://sentinel-dashboard.thienhn.io.vn';
const csrf = 'csrf-test-token';
const now = new Date();

function activeRps(): GameState {
  return {
    sessionId, guildId, kind: 'rps', creatorId, opponentId, phase: 'active', version: 0,
    expiresAt: new Date(now.getTime() + 30 * 60_000),
    deleteAt: new Date(now.getTime() + 25 * 60 * 60_000), choices: { [creatorId]: 'rock' }
  };
}

describe('shared game routes', () => {
  let app: ReturnType<typeof buildFastifyServer>;
  let memberFetch: ReturnType<typeof vi.fn>;
  beforeAll(async () => {
    vi.stubEnv('SESSION_SECRET', 'test-session-secret-with-at-least-32-bytes');
    vi.stubEnv('FRONTEND_URL', origin);
    memberFetch = vi.fn().mockResolvedValue({ user: { id: creatorId } });
    const guild = { id: guildId, members: { fetch: memberFetch } };
    const client = { guilds: { cache: new Map([[guildId, guild]]) } } as unknown as Client;
    app = buildFastifyServer(client);
    await app.ready();
  });
  afterAll(async () => { await app.close(); vi.unstubAllEnvs(); });
  beforeEach(() => {
    vi.restoreAllMocks();
    memberFetch.mockReset().mockResolvedValue({ user: { id: creatorId } });
    vi.spyOn(GameSessionModel, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(activeRps()) } as never);
    vi.spyOn(AuthSessionModel, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({
      userId: creatorId, username: 'Alice', avatar: null, csrfToken: csrf,
      oauthGuilds: [], expiresAt: new Date(Date.now() + 60_000)
    }) } as never);
  });

  it('hides an unrevealed choice from anonymous and opposing readers', async () => {
    const anonymous = await app.inject(`/api/games/${sessionId}`);
    expect(anonymous.statusCode).toBe(200);
    expect(anonymous.body).not.toContain('rock');
    const player = await app.inject({ url: `/api/games/${sessionId}`, headers: { cookie } });
    expect(player.statusCode).toBe(200);
    expect(player.json().rps.ownChoice).toBe('rock');
    expect(player.headers['cache-control']).toBe('no-store');
  });

  it('requires login, Origin and CSRF for mutations', async () => {
    const url = `/api/games/${sessionId}/actions`;
    const body = { type: 'choose', choice: 'paper' };
    expect((await app.inject({ method: 'POST', url, payload: body })).statusCode).toBe(401);
    expect((await app.inject({ method: 'POST', url, payload: body, headers: { cookie } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url, payload: body, headers: { cookie, origin, 'x-csrf-token': 'wrong' } })).statusCode).toBe(403);
  });

  it('rejects a departed member before changing the game', async () => {
    memberFetch.mockRejectedValue(new Error('not a member'));
    const update = vi.spyOn(GameSessionModel, 'findOneAndUpdate');
    const response = await app.inject({ method: 'POST', url: `/api/games/${sessionId}/actions`,
      payload: { type: 'choose', choice: 'paper' }, headers: { cookie, origin, 'x-csrf-token': csrf } });
    expect(response.statusCode).toBe(403);
    expect(update).not.toHaveBeenCalled();
  });

  it('rejects malformed actions and expired sessions', async () => {
    const url = `/api/games/${sessionId}/actions`;
    const headers = { cookie, origin, 'x-csrf-token': csrf };
    expect((await app.inject({ method: 'POST', url, payload: { type: 'place', cell: 'zero' }, headers })).statusCode).toBe(400);
    vi.spyOn(GameSessionModel, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({
      ...activeRps(), expiresAt: new Date(Date.now() - 1)
    }) } as never);
    expect((await app.inject({ method: 'POST', url, payload: { type: 'choose', choice: 'paper' }, headers })).statusCode).toBe(410);
  });

  it('requires a current guild member to create a web game', async () => {
    vi.spyOn(GameSessionModel, 'updateMany').mockResolvedValue({ modifiedCount: 0 } as never);
    vi.spyOn(GameSessionModel, 'create').mockImplementation(async (value) => value as never);
    const url = '/api/games';
    const headers = { cookie, origin, 'x-csrf-token': csrf };
    memberFetch.mockRejectedValueOnce(new Error('left guild'));
    expect((await app.inject({ method: 'POST', url, payload: { guildId, kind: 'rps' }, headers })).statusCode).toBe(403);
    expect((await app.inject({ method: 'POST', url, payload: { guildId, kind: 'rps' }, headers })).statusCode).toBe(201);
  });
});
