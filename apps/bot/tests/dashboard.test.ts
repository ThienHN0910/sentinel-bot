import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { buildFastifyServer } from '../src/api/server';
import { UserStatModel } from '../src/models/UserStat';
import { WordStatModel } from '../src/models/WordStat';
import { ActivityBucketModel } from '../src/models/ActivityBucket';
import { VoiceSessionModel } from '../src/models/VoiceSession';
import { buildActivityHeatmap } from '../src/api/routes/dashboard';

describe('live dashboard API', () => {
  const guild = { id: 'guild-1', name: 'Live Guild', memberCount: 42, voiceStates: { cache: new Map([['u1', {}]]) } };
  const client = { guilds: { cache: new Map([[guild.id, guild]]) } } as any;
  const app = buildFastifyServer(client);

  beforeAll(() => app.ready());
  afterAll(() => app.close());

  it('lists guilds from the connected Discord client', async () => {
    const res = await app.inject('/api/guilds');
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ guilds: [{ id: 'guild-1', name: 'Live Guild' }] });
  });

  it('rejects dashboard access for a guild the bot has not joined', async () => {
    const res = await app.inject('/api/guilds/unknown/dashboard');
    expect(res.statusCode).toBe(404);
  });

  it('returns current Discord counts and MongoDB statistics', async () => {
    vi.spyOn(UserStatModel, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [{ userId: 'u1', username: 'Alice', avatar: '', totalMessages: 7, totalVoiceSeconds: 300 }] }) }) } as any);
    const aggregate = vi.spyOn(UserStatModel, 'aggregate').mockResolvedValue([{ totalMessages: 7, totalVoiceSeconds: 300 }] as any);
    vi.spyOn(WordStatModel, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [{ word: 'hello', count: 3 }] }) }) } as any);
    vi.spyOn(ActivityBucketModel, 'find').mockReturnValue({ lean: async () => [] } as any);
    vi.spyOn(VoiceSessionModel, 'find').mockReturnValue({ lean: async () => [{ guildId: 'guild-1', userId: 'u1', startedAt: new Date(Date.now() - 600_000) }] } as any);

    const [res, duplicate] = await Promise.all([
      app.inject('/api/guilds/guild-1/dashboard'),
      app.inject('/api/guilds/guild-1/dashboard')
    ]);
    expect(res.statusCode).toBe(200);
    expect(duplicate.statusCode).toBe(200);
    expect(res.json()).toMatchObject({
      guild: { id: 'guild-1', name: 'Live Guild' },
      stats: { members: 42, voiceNow: 1, messages: 7, voiceCompletedSeconds: 300 },
      podium: [{ username: 'Alice', score: 7, rank: 1 }],
      topVoice: [{ username: 'Alice', rank: 1 }],
      words: [{ text: 'hello', count: 3 }]
    });
    expect(res.json().stats.voiceActiveEstimatedSeconds).toBeGreaterThanOrEqual(599);
    expect(res.json().stats.voiceActiveEstimatedSeconds).toBeLessThanOrEqual(600);
    expect(res.json().stats.voiceTotalEstimatedSeconds).toBe(300 + res.json().stats.voiceActiveEstimatedSeconds);
    expect(res.json().topVoice[0].score).toBe(res.json().stats.voiceTotalEstimatedSeconds);
    expect(aggregate).toHaveBeenCalledTimes(1);
    expect(UserStatModel.aggregate).toHaveBeenCalledWith([
      { $match: { guildId: 'guild-1' } },
      { $group: { _id: null, totalMessages: { $sum: '$totalMessages' }, totalVoiceSeconds: { $sum: '$totalVoiceSeconds' } } }
    ]);
  });

  it('returns zero values for a joined guild without recorded activity', async () => {
    const emptyGuild = { id: 'empty', name: 'Empty', memberCount: 2, voiceStates: { cache: new Map() } };
    const emptyApp = buildFastifyServer({ guilds: { cache: new Map([['empty', emptyGuild]]) } } as any);
    vi.spyOn(UserStatModel, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) } as any);
    vi.spyOn(UserStatModel, 'aggregate').mockResolvedValue([]);
    vi.spyOn(WordStatModel, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => [] }) }) } as any);
    vi.spyOn(ActivityBucketModel, 'find').mockReturnValue({ lean: async () => [] } as any);
    vi.spyOn(VoiceSessionModel, 'find').mockReturnValue({ lean: async () => [] } as any);
    await emptyApp.ready();
    try {
      const response = await emptyApp.inject('/api/guilds/empty/dashboard');
      expect(response.json()).toMatchObject({
        stats: { messages: 0, voiceCompletedSeconds: 0, voiceActiveEstimatedSeconds: 0, voiceTotalEstimatedSeconds: 0 },
        podium: [], topVoice: [], words: []
      });
    } finally {
      await emptyApp.close();
    }
  });
});

describe('activity heatmap', () => {
  it('places UTC hourly buckets in the correct day and hour', () => {
    const result = buildActivityHeatmap(
      [{ hour: new Date('2026-09-27T08:00:00.000Z'), messages: 3, voiceJoins: 2 }],
      new Date('2026-09-27T12:00:00.000Z')
    );
    expect(result.days).toHaveLength(7);
    expect(result.messagesMatrix[6][8]).toBe(3);
    expect(result.voiceJoinsMatrix[6][8]).toBe(2);
    expect(result.messagesMatrix[6][9]).toBe(0);
  });
});

describe('health telemetry wiring', () => {
  it('reads the governor instance supplied by the running bot', async () => {
    const governor = { getTelemetry: () => ({ cpuPercent: 23, busyMs: 42, memoryRssMb: 137, lastUpdated: new Date('2026-09-27T12:00:00Z') }) } as any;
    const app = buildFastifyServer(undefined, governor);
    const res = await app.inject('/api/health');
    expect(res.json().telemetry.cpuPercent).toBe(23);
    await app.close();
  });
});
