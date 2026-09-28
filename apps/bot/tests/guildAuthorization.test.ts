import { describe, expect, it, vi } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import { authorizeGuildManager } from '../src/services/auth/guildAuthorization';

describe('current guild manager authorization', () => {
  it('rejects a role whose Manage Server permission was revoked after cache population', async () => {
    const stale = { ownerId: 'owner', members: { fetch: vi.fn(async () => ({ permissions: { has: () => true } })) } };
    const fresh = { ownerId: 'owner', members: { fetch: vi.fn(async () => ({ permissions: { has: () => false } })) } };
    const client = { guilds: { cache: new Map([['guild-1', stale]]), fetch: vi.fn(async () => fresh) } } as any;
    await expect(authorizeGuildManager(client, 'guild-1', 'manager')).rejects.toMatchObject({ statusCode: 403 });
    expect(client.guilds.fetch).toHaveBeenCalledWith({ guild: 'guild-1', force: true });
    expect(fresh.members.fetch).toHaveBeenCalledWith({ user: 'manager', force: true });
    expect(PermissionFlagsBits.ManageGuild).toBeDefined();
  });

  it('rejects a former owner when Discord reports a new owner', async () => {
    const stale = { ownerId: 'old-owner' };
    const fresh = { ownerId: 'new-owner', members: { fetch: vi.fn(async () => ({ permissions: { has: () => false } })) } };
    const client = { guilds: { cache: new Map([['guild-1', stale]]), fetch: vi.fn(async () => fresh) } } as any;
    await expect(authorizeGuildManager(client, 'guild-1', 'old-owner')).rejects.toMatchObject({ statusCode: 403 });
  });

  it('denies access when the fresh Discord guild cannot be fetched', async () => {
    const client = { guilds: { cache: new Map([['guild-1', { ownerId: 'owner' }]]), fetch: vi.fn().mockRejectedValue(new Error('Discord down')) } } as any;
    await expect(authorizeGuildManager(client, 'guild-1', 'owner')).rejects.toMatchObject({ statusCode: 403 });
  });
});
