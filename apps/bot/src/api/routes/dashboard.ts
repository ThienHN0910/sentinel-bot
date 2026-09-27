import type { Client } from 'discord.js';
import type { FastifyInstance } from 'fastify';
import { UserStatModel } from '../../models/UserStat';
import { VoiceSessionModel, type VoiceSession } from '../../models/VoiceSession';
import { WordStatModel } from '../../models/WordStat';
import { ActivityBucketModel, type ActivityBucket } from '../../models/ActivityBucket';
import { getActiveVoiceSeconds } from '../../services/voice/voiceStats';

export function buildActivityHeatmap(buckets: Pick<ActivityBucket, 'hour' | 'messages' | 'voiceJoins'>[], now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - 6 + index);
    return date.toISOString().slice(0, 10);
  });
  const messagesMatrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const voiceJoinsMatrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const bucket of buckets) {
    const date = new Date(bucket.hour);
    const dayIndex = days.indexOf(date.toISOString().slice(0, 10));
    if (dayIndex >= 0 && date <= now) {
      messagesMatrix[dayIndex][date.getUTCHours()] += bucket.messages;
      voiceJoinsMatrix[dayIndex][date.getUTCHours()] += bucket.voiceJoins;
    }
  }
  const matrix = messagesMatrix.map((row, day) => row.map((count, hour) => count + voiceJoinsMatrix[day][hour]));
  return { days, messagesMatrix, voiceJoinsMatrix, matrix };
}

export function createDashboardSnapshotCache<T>(ttlMs = 30_000, clock: () => number = Date.now) {
  const entries = new Map<string, { promise?: Promise<T>; value?: T; expiresAt: number }>();
  return {
    get(key: string, load: () => Promise<T>): Promise<T> {
      const current = entries.get(key);
      if (current?.promise) return current.promise;
      if (current && current.expiresAt > clock()) return Promise.resolve(current.value as T);
      const entry: { promise?: Promise<T>; value?: T; expiresAt: number } = { expiresAt: 0 };
      const promise = load().then((value) => {
        entry.value = value;
        entry.expiresAt = clock() + ttlMs;
        entry.promise = undefined;
        return value;
      }, (error) => {
        if (entries.get(key) === entry) entries.delete(key);
        throw error;
      });
      entry.promise = promise;
      entries.set(key, entry);
      return promise;
    }
  };
}

export async function dashboardRoutes(app: FastifyInstance, client?: Client) {
  type Snapshot = Awaited<ReturnType<typeof loadSnapshot>>;
  const snapshots = createDashboardSnapshotCache<Snapshot>();

  async function loadSnapshot(guildId: string, now: Date) {
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 6));
    const [topChat, topCompletedVoice, totals, words, buckets, sessions] = await Promise.all([
      UserStatModel.find({ guildId }).sort({ totalMessages: -1 }).limit(3).lean(),
      UserStatModel.find({ guildId }).sort({ totalVoiceSeconds: -1 }).limit(10).lean(),
      UserStatModel.aggregate([{ $match: { guildId } }, { $group: { _id: null, totalMessages: { $sum: '$totalMessages' }, totalVoiceSeconds: { $sum: '$totalVoiceSeconds' } } }]),
      WordStatModel.find({ guildId }).sort({ count: -1 }).limit(30).lean(),
      ActivityBucketModel.find({ guildId, hour: { $gte: start } }).lean(),
      VoiceSessionModel.find({ guildId }).lean()
    ]);
    const topIds = new Set(topCompletedVoice.map((user) => user.userId));
    const missingIds = [...new Set(sessions.map((session) => session.userId))].filter((userId) => !topIds.has(userId));
    const activeCompletedVoice = missingIds.length
      ? await UserStatModel.find({ guildId, userId: { $in: missingIds } }).lean()
      : [];
    return { topChat, topCompletedVoice, activeCompletedVoice, totals, words, buckets, sessions };
  }

  app.get('/api/guilds', async () => ({
    guilds: client ? [...client.guilds.cache.values()].map(({ id, name }) => ({ id, name })) : []
  }));

  app.get('/api/guilds/:guildId/dashboard', async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const guild = client?.guilds.cache.get(guildId);
    if (!guild) return reply.code(404).send({ error: 'Guild not found' });

    const now = new Date();
    const { topChat, topCompletedVoice, activeCompletedVoice, totals, words, buckets, sessions } = await snapshots.get(guildId, () => loadSnapshot(guildId, now));
    const liveSessions = (sessions as VoiceSession[]).filter((session) => guild.voiceStates.cache.has(session.userId));
    const activeByUser = new Map(liveSessions.map((session) => [session.userId, getActiveVoiceSeconds(session, now)]));
    const activeSeconds = [...activeByUser.values()].reduce((sum, duration) => sum + duration, 0);
    const completedSeconds = totals[0]?.totalVoiceSeconds ?? 0;
    const voiceUsers = new Map<string, { userId: string; username: string; avatar: string; score: number }>();
    for (const user of [...topCompletedVoice, ...activeCompletedVoice]) {
      voiceUsers.set(user.userId, {
        userId: user.userId, username: user.username, avatar: user.avatar,
        score: user.totalVoiceSeconds + (activeByUser.get(user.userId) ?? 0)
      });
    }
    for (const session of liveSessions) {
      if (voiceUsers.has(session.userId)) continue;
      const state = guild.voiceStates.cache.get(session.userId);
      voiceUsers.set(session.userId, {
        userId: session.userId,
        username: state?.member?.user.username ?? 'User',
        avatar: state?.member?.user.displayAvatarURL() ?? '',
        score: activeByUser.get(session.userId) ?? 0
      });
    }

    return {
      guild: { id: guild.id, name: guild.name },
      stats: {
        members: guild.memberCount,
        voiceNow: guild.voiceStates.cache.size,
        messages: totals[0]?.totalMessages ?? 0,
        voiceCompletedSeconds: completedSeconds,
        voiceActiveEstimatedSeconds: activeSeconds,
        voiceTotalEstimatedSeconds: completedSeconds + activeSeconds
      },
      podium: topChat.map((user, index) => ({
        rank: index + 1, userId: user.userId, username: user.username,
        avatar: user.avatar, score: user.totalMessages
      })),
      topVoice: [...voiceUsers.values()]
        .sort((left, right) => right.score - left.score)
        .slice(0, 10)
        .map((user, index) => ({ ...user, rank: index + 1 })),
      words: words.map(({ word, count }) => ({ text: word, count })),
      activity: buildActivityHeatmap(buckets, now),
      updatedAt: now.toISOString()
    };
  });
}
