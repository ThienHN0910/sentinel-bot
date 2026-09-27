import { FastifyInstance } from 'fastify';
import { UserStatModel } from '../../models/UserStat';
import { WordStatModel } from '../../models/WordStat';

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get('/api/guilds/:guildId/leaderboard', async (req) => {
    const { guildId } = req.params as { guildId: string };

    const [topVoice, topChat, topLevel] = await Promise.all([
      UserStatModel.find({ guildId }).sort({ totalVoiceSeconds: -1 }).limit(10).lean(),
      UserStatModel.find({ guildId }).sort({ totalMessages: -1 }).limit(10).lean(),
      UserStatModel.find({ guildId }).sort({ level: -1, exp: -1 }).limit(10).lean()
    ]);

    const publicRows = (users: typeof topVoice, score: (user: typeof topVoice[number]) => number) =>
      users.map((user, index) => ({
        rank: index + 1,
        userId: user.userId,
        username: user.username,
        avatar: user.avatar,
        score: score(user)
      }));

    return {
      topVoice: publicRows(topVoice, (user) => user.totalVoiceSeconds),
      topChat: publicRows(topChat, (user) => user.totalMessages),
      topLevel: publicRows(topLevel, (user) => user.level)
    };
  });

  app.get('/api/guilds/:guildId/wordcloud', async (req) => {
    const { guildId } = req.params as { guildId: string };
    const words = await WordStatModel.find({ guildId }).sort({ count: -1 }).limit(50).lean();
    return { words };
  });
}
