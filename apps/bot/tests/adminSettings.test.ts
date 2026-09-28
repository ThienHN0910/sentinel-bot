import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFastifyServer } from '../src/api/server';
import { AuthSessionModel } from '../src/models/AuthSession';
import { GuildConfigModel } from '../src/models/GuildConfig';

const origin = 'https://sentinel-dashboard.thienhn.io.vn';
const cookie = `sentinel_sid=${'x'.repeat(43)}`;
const csrf = 'valid-csrf-token';
const authHeaders = { cookie };
const writeHeaders = { cookie, origin, 'x-csrf-token': csrf };
let userId = 'manager';
let canManage = true;
let memberFetchFails = false;
let config: any;
let channelWritable = true;
const channel = {
  id: 'channel-1', guildId: 'guild-1', type: 0, name: 'reports',
  permissionsFor: () => ({ has: () => channelWritable })
};
const guild = {
  id: 'guild-1', name: 'Test Guild', ownerId: 'owner',
  members: {
    me: { id: 'bot' },
    fetch: vi.fn(async () => {
      if (memberFetchFails) throw new Error('Discord unavailable');
      return { permissions: { has: () => canManage } };
    })
  },
  channels: { cache: new Map([[channel.id, channel]]), fetch: vi.fn(async (id: string) => id === channel.id ? channel : null) }
};
const client = { guilds: { cache: new Map([[guild.id, guild]]) } } as any;

describe('server management API', () => {
  const app = buildFastifyServer(client);
  beforeAll(async () => {
    vi.stubEnv('FRONTEND_URL', origin);
    vi.stubEnv('SESSION_SECRET', 'test-session-secret-with-at-least-32-bytes');
    await app.ready();
  });
  afterAll(async () => { await app.close(); vi.unstubAllEnvs(); });
  beforeEach(() => {
    vi.restoreAllMocks();
    userId = 'manager'; canManage = true; memberFetchFails = false; channelWritable = true;
    config = { guildId: 'guild-1', name: 'Test Guild', welcomeVoiceTts: true, welcomeMessage: 'Chào {user}', reportChannelId: undefined };
    vi.spyOn(AuthSessionModel, 'findOne').mockImplementation((() => ({ lean: async () => ({
      userId, username: 'Manager', avatar: null, csrfToken: csrf,
      oauthGuilds: [{ id: 'guild-1', owner: userId === 'owner', permissions: '32' }],
      expiresAt: new Date(Date.now() + 86_400_000)
    }) })) as any);
    vi.spyOn(GuildConfigModel, 'findOne').mockImplementation((() => ({ lean: async () => config })) as any);
    vi.spyOn(GuildConfigModel, 'findOneAndUpdate').mockImplementation((async (_filter: any, update: any) => {
      config = { ...config, ...update.$set };
      if (update.$unset?.reportChannelId) delete config.reportChannelId;
      return config;
    }) as any);
  });

  it('requires login for settings reads and writes', async () => {
    expect((await app.inject('/api/admin/guilds/guild-1/settings')).statusCode).toBe(401);
    expect((await app.inject({ method: 'PATCH', url: '/api/admin/guilds/guild-1/settings', payload: { welcomeVoiceTts: false } })).statusCode).toBe(401);
  });

  it('lists only currently manageable guilds where the bot is installed', async () => {
    const available = await app.inject({ url: '/api/admin/guilds', headers: authHeaders });
    expect(available.statusCode).toBe(200);
    expect(available.json()).toEqual({ guilds: [{ id: 'guild-1', name: 'Test Guild' }] });
    canManage = false;
    expect((await app.inject({ url: '/api/admin/guilds', headers: authHeaders })).json()).toEqual({ guilds: [] });
  });

  it('lets owner and current Manage Server member read and save settings', async () => {
    const response = await app.inject({ url: '/api/admin/guilds/guild-1/settings', headers: authHeaders });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ welcomeVoiceTts: true, welcomeMessage: 'Chào {user}', channels: [{ id: 'channel-1' }] });
    const save = await app.inject({ method: 'PATCH', url: '/api/admin/guilds/guild-1/settings', headers: writeHeaders, payload: { welcomeVoiceTts: false, welcomeMessage: 'Mừng {user}', reportChannelId: 'channel-1' } });
    expect(save.statusCode).toBe(200);
    expect(save.json()).toMatchObject({ welcomeVoiceTts: false, welcomeMessage: 'Mừng {user}', reportChannelId: 'channel-1' });
    userId = 'owner'; canManage = false;
    expect((await app.inject({ url: '/api/admin/guilds/guild-1/settings', headers: authHeaders })).statusCode).toBe(200);
  });

  it('denies the next read and write after Manage Server is revoked', async () => {
    canManage = false;
    expect((await app.inject({ url: '/api/admin/guilds/guild-1/settings', headers: authHeaders })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url: '/api/admin/guilds/guild-1/settings', headers: writeHeaders, payload: { welcomeVoiceTts: false } })).statusCode).toBe(403);
  });

  it('fails closed when Discord cannot confirm permissions or bot is absent', async () => {
    memberFetchFails = true;
    expect((await app.inject({ url: '/api/admin/guilds/guild-1/settings', headers: authHeaders })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/admin/guilds/missing/settings', headers: authHeaders })).statusCode).toBe(404);
  });

  it('rejects invalid fields, templates, and report channels', async () => {
    const save = (payload: object) => app.inject({ method: 'PATCH', url: '/api/admin/guilds/guild-1/settings', headers: writeHeaders, payload });
    expect((await save({ unknown: 1 })).statusCode).toBe(400);
    expect((await save({ welcomeMessage: 'Hello {everyone}' })).statusCode).toBe(400);
    expect((await save({ welcomeMessage: 'x'.repeat(201) })).statusCode).toBe(400);
    expect((await save({ reportChannelId: 'foreign-channel' })).statusCode).toBe(400);
    channelWritable = false;
    expect((await save({ reportChannelId: 'channel-1' })).statusCode).toBe(400);
  });

  it('clears the report channel and rejects writes without Origin or CSRF', async () => {
    config.reportChannelId = 'channel-1';
    const url = '/api/admin/guilds/guild-1/settings';
    expect((await app.inject({ method: 'PATCH', url, headers: authHeaders, payload: { reportChannelId: null } })).statusCode).toBe(403);
    expect((await app.inject({ method: 'PATCH', url, headers: { cookie, origin }, payload: { reportChannelId: null } })).statusCode).toBe(403);
    const response = await app.inject({ method: 'PATCH', url, headers: writeHeaders, payload: { reportChannelId: null } });
    expect(response.statusCode).toBe(200);
    expect(response.json().reportChannelId).toBeNull();
  });
});
