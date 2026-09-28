import { calculateLevel, type RankingMetric, type RankingPage } from '@sentinel/shared';
import { UserStatModel } from '../../models/UserStat';

const PAGE_SIZE = 25;
const SCORE_FIELDS: Record<RankingMetric, 'totalMessages' | 'totalVoiceSeconds' | 'exp'> = {
  chat: 'totalMessages', voice: 'totalVoiceSeconds', level: 'exp'
};

interface RankingCursor {
  guildId: string;
  metric: RankingMetric;
  score: number;
  userId: string;
  rankOffset: number;
}

export class InvalidRankingCursor extends Error {}

export function isRankingMetric(value: unknown): value is RankingMetric {
  return typeof value === 'string' && Object.hasOwn(SCORE_FIELDS, value);
}

export function parseRankingCursor(value: string | undefined, guildId: string, metric: RankingMetric): RankingCursor | null {
  if (value === undefined) return null;
  if (value.length === 0 || value.length > 512 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new InvalidRankingCursor('Invalid cursor');
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed || typeof parsed !== 'object') throw new Error('Invalid payload');
    const cursor = parsed as Partial<RankingCursor>;
    if (cursor.guildId !== guildId || cursor.metric !== metric ||
      typeof cursor.userId !== 'string' || cursor.userId.length === 0 || cursor.userId.length > 100 ||
      typeof cursor.score !== 'number' || !Number.isFinite(cursor.score) || cursor.score < 0 ||
      typeof cursor.rankOffset !== 'number' || !Number.isSafeInteger(cursor.rankOffset) || cursor.rankOffset < 1) {
      throw new Error('Invalid payload');
    }
    return cursor as RankingCursor;
  } catch {
    throw new InvalidRankingCursor('Invalid cursor');
  }
}

export async function getRankingPage(guildId: string, metric: RankingMetric, cursor?: string): Promise<RankingPage> {
  const after = parseRankingCursor(cursor, guildId, metric);
  const scoreField = SCORE_FIELDS[metric];
  const filter = after ? {
    guildId,
    $or: [
      { [scoreField]: { $lt: after.score } },
      { [scoreField]: after.score, userId: { $gt: after.userId } }
    ]
  } : { guildId };
  const users = await UserStatModel.find(filter)
    .sort({ [scoreField]: -1, userId: 1 })
    .limit(PAGE_SIZE + 1)
    .select('userId username avatar totalMessages totalVoiceSeconds exp')
    .lean();
  const visible = users.slice(0, PAGE_SIZE);
  const rankOffset = after?.rankOffset ?? 0;
  const rows = visible.map((user, index) => ({
    rank: rankOffset + index + 1,
    userId: user.userId,
    username: user.username,
    avatar: user.avatar,
    score: user[scoreField],
    ...(metric === 'level' ? { level: calculateLevel(user.exp) } : {})
  }));
  const last = visible.at(-1);
  const nextCursor = users.length > PAGE_SIZE && last ? Buffer.from(JSON.stringify({
    guildId, metric, score: last[scoreField], userId: last.userId, rankOffset: rankOffset + PAGE_SIZE
  })).toString('base64url') : null;
  return { rows, nextCursor, generatedAt: new Date().toISOString() };
}
