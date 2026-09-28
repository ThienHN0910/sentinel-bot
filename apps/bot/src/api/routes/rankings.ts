import type { Client } from 'discord.js';
import type { FastifyInstance } from 'fastify';
import { getRankingPage, InvalidRankingCursor, isRankingMetric, parseRankingCursor } from '../../services/analytics/rankings';

export async function rankingRoutes(app: FastifyInstance, client?: Client) {
  app.get('/api/guilds/:guildId/rankings', async (request, reply) => {
    const { guildId } = request.params as { guildId: string };
    const { metric, cursor } = request.query as { metric?: string; cursor?: string };
    if (!isRankingMetric(metric) || (cursor !== undefined && typeof cursor !== 'string')) {
      return reply.code(400).send({ error: 'Invalid ranking request' });
    }
    try {
      parseRankingCursor(cursor, guildId, metric);
    } catch (error) {
      if (error instanceof InvalidRankingCursor) return reply.code(400).send({ error: 'Invalid cursor' });
      throw error;
    }
    if (!client?.guilds.cache.has(guildId)) return reply.code(404).send({ error: 'Guild not found' });
    return getRankingPage(guildId, metric, cursor);
  });
}
