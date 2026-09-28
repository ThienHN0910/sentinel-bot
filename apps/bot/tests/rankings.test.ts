import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { buildFastifyServer } from '../src/api/server';
import { UserStatModel } from '../src/models/UserStat';

const guild = { id: 'guild-1', name: 'Test Guild' };
const client = { guilds: { cache: new Map([[guild.id, guild]]) } } as any;
const app = buildFastifyServer(client);

type Stat = {
  guildId: string; userId: string; username: string; avatar: string;
  totalMessages: number; totalVoiceSeconds: number; exp: number; level: number; dneCoins: number;
};

function mockStats(rows: Stat[]) {
  vi.spyOn(UserStatModel, 'find').mockImplementation(((filter: any) => {
    let sort: Record<string, number> = {};
    let limit = 0;
    const query = {
      sort(value: Record<string, number>) { sort = value; return query; },
      limit(value: number) { limit = value; return query; },
      select() { return query; },
      async lean() {
        const scoreField = Object.keys(sort)[0] as keyof Stat;
        const after = (row: Stat) => !filter.$or || filter.$or.some((part: Record<string, any>) =>
          Object.entries(part).every(([key, value]) => {
            const actual = row[key as keyof Stat];
            if (typeof value === 'object' && value !== null) {
              if ('$lt' in value) return actual < value.$lt;
              if ('$gt' in value) return actual > value.$gt;
            }
            return actual === value;
          })
        );
        return rows.filter((row) => row.guildId === filter.guildId && after(row))
          .sort((a, b) => Number(b[scoreField]) - Number(a[scoreField]) || a.userId.localeCompare(b.userId))
          .slice(0, limit);
      }
    };
    return query;
  }) as any);
}

describe('public ranking API', () => {
  beforeAll(() => app.ready());
  afterAll(() => app.close());
  beforeEach(() => vi.restoreAllMocks());

  it('paginates tied chat scores without skipping or duplicating a user', async () => {
    mockStats(Array.from({ length: 26 }, (_, index) => ({
      guildId: 'guild-1', userId: `u${String(index).padStart(2, '0')}`,
      username: `User ${index}`, avatar: '', totalMessages: 100,
      totalVoiceSeconds: 0, exp: 0, level: 1, dneCoins: 999
    })));
    const first = await app.inject('/api/guilds/guild-1/rankings?metric=chat');
    expect(first.statusCode).toBe(200);
    expect(first.json().rows).toHaveLength(25);
    expect(first.json().rows[0]).toMatchObject({ rank: 1, userId: 'u00', score: 100 });
    expect(first.json().rows[24]).toMatchObject({ rank: 25, userId: 'u24' });
    expect(first.json().rows[0]).not.toHaveProperty('dneCoins');

    const second = await app.inject(`/api/guilds/guild-1/rankings?metric=chat&cursor=${encodeURIComponent(first.json().nextCursor)}`);
    expect(second.statusCode).toBe(200);
    expect(second.json().rows).toEqual([expect.objectContaining({ rank: 26, userId: 'u25' })]);
    expect(second.json().nextCursor).toBeNull();
  });

  it('rejects malformed or cross-guild and cross-metric cursors', async () => {
    mockStats(Array.from({ length: 26 }, (_, index) => ({
      guildId: 'guild-1', userId: `u${index}`, username: `User ${index}`, avatar: '',
      totalMessages: 26 - index, totalVoiceSeconds: 0, exp: 0, level: 1, dneCoins: 0
    })));
    const first = await app.inject('/api/guilds/guild-1/rankings?metric=chat');
    const cursor = encodeURIComponent(first.json().nextCursor);
    expect((await app.inject(`/api/guilds/guild-1/rankings?metric=voice&cursor=${cursor}`)).statusCode).toBe(400);
    expect((await app.inject(`/api/guilds/other/rankings?metric=chat&cursor=${cursor}`)).statusCode).toBe(400);
    expect((await app.inject(`/api/guilds/guild-1/rankings?metric=chat&cursor=${'x'.repeat(2048)}`)).statusCode).toBe(400);
  });

  it('rejects unknown guilds and ranks level by XP instead of stored level', async () => {
    mockStats([
      { guildId: 'guild-1', userId: 'low', username: 'Low', avatar: '', totalMessages: 0, totalVoiceSeconds: 0, exp: 100, level: 10, dneCoins: 0 },
      { guildId: 'guild-1', userId: 'high', username: 'High', avatar: '', totalMessages: 0, totalVoiceSeconds: 0, exp: 282, level: 1, dneCoins: 0 }
    ]);
    expect((await app.inject('/api/guilds/unknown/rankings?metric=chat')).statusCode).toBe(404);
    const response = await app.inject('/api/guilds/guild-1/rankings?metric=level');
    expect(response.statusCode).toBe(200);
    expect(response.json().rows).toEqual([
      expect.objectContaining({ userId: 'high', score: 282, level: 2 }),
      expect.objectContaining({ userId: 'low', score: 100, level: 1 })
    ]);
  });

  it('keeps the old top-ten API but derives its level order from XP', async () => {
    mockStats([
      { guildId: 'guild-1', userId: 'low', username: 'Low', avatar: '', totalMessages: 0, totalVoiceSeconds: 0, exp: 100, level: 10, dneCoins: 0 },
      { guildId: 'guild-1', userId: 'high', username: 'High', avatar: '', totalMessages: 0, totalVoiceSeconds: 0, exp: 282, level: 1, dneCoins: 0 }
    ]);
    const response = await app.inject('/api/guilds/guild-1/leaderboard');
    expect(response.statusCode).toBe(200);
    expect(response.json().topLevel).toEqual([
      expect.objectContaining({ userId: 'high', score: 2, rank: 1 }),
      expect.objectContaining({ userId: 'low', score: 1, rank: 2 })
    ]);
  });
});
