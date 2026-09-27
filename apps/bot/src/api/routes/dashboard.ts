import type { Client } from 'discord.js';
import type { FastifyInstance } from 'fastify';
import { UserStatModel } from '../../models/UserStat';
import { WordStatModel } from '../../models/WordStat';
import { ActivityBucketModel, type ActivityBucket } from '../../models/ActivityBucket';

export function buildActivityHeatmap(buckets: Pick<ActivityBucket, 'hour' | 'messages' | 'voiceJoins'>[], now = new Date()) {
  const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(date.getUTCDate() - 6 + index);
    return date.toISOString().slice(0, 10);
  });
  const matrix = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const bucket of buckets) {
    const date = new Date(bucket.hour);
    const dayIndex = days.indexOf(date.toISOString().slice(0, 10));
    if (dayIndex >= 0 && date <= now) {
      matrix[dayIndex][date.getUTCHours()] += bucket.messages + bucket.voiceJoins;
    }
  }
  return { days, matrix };
}

export async function dashboardRoutes(app: FastifyInstance, client?: Client) {
  app.get('/api/guilds', async () => ({
    guilds: client ? [...client.guilds.cache.values()].map(({ id, name }) => ({ id, name })) : []
  }));

  app.get('/api/guilds/:guildId/dashboard', async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const guild = client?.guilds.cache.get(guildId);
    if (!guild) return reply.code(404).send({ error: 'Guild not found' });

    const today = new Date();
    const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 6));
    const [topChat, totals, words, buckets] = await Promise.all([
      UserStatModel.find({ guildId }).sort({ totalMessages: -1 }).limit(3).lean(),
      UserStatModel.aggregate([{ $match: { guildId } }, { $group: { _id: null, totalMessages: { $sum: '$totalMessages' } } }]),
      WordStatModel.find({ guildId }).sort({ count: -1 }).limit(30).lean(),
      ActivityBucketModel.find({ guildId, hour: { $gte: start } }).lean()
    ]);

    return {
      guild: { id: guild.id, name: guild.name },
      stats: {
        members: guild.memberCount,
        voiceNow: guild.voiceStates.cache.size,
        messages: totals[0]?.totalMessages ?? 0
      },
      podium: topChat.map((user, index) => ({
        rank: index + 1,
        username: user.username,
        avatar: user.avatar,
        score: user.totalMessages
      })),
      words: words.map(({ word, count }) => ({ text: word, count })),
      activity: buildActivityHeatmap(buckets, today),
      updatedAt: today.toISOString()
    };
  });
}
