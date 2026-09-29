import type { Guild } from 'discord.js';
import { UserStatModel } from '../../models/UserStat';
import { VoiceSessionModel } from '../../models/VoiceSession';
import { getActiveVoiceSeconds } from '../voice/voiceStats';

export interface ServerStatsSnapshot {
  members: number;
  messages: number;
  voiceCompletedSeconds: number;
  voiceActiveEstimatedSeconds: number;
  updatedAt: string;
}

const CACHE_MS = 30_000;
const cache = new Map<string, { expiresAt: number; promise: Promise<ServerStatsSnapshot> }>();

export function getServerStats(guild: Guild, now = new Date()): Promise<ServerStatsSnapshot> {
  const cached = cache.get(guild.id);
  if (cached && cached.expiresAt > now.getTime()) return cached.promise;
  const promise = (async () => {
    const activeIds = [...guild.voiceStates.cache.keys()];
    const [totals, sessions] = await Promise.all([
      UserStatModel.aggregate<{ totalMessages: number; totalVoiceSeconds: number }>([
        { $match: { guildId: guild.id } },
        { $group: { _id: null, totalMessages: { $sum: '$totalMessages' }, totalVoiceSeconds: { $sum: '$totalVoiceSeconds' } } }
      ]),
      activeIds.length ? VoiceSessionModel.find({ guildId: guild.id, userId: { $in: activeIds } }).lean() : Promise.resolve([])
    ]);
    return {
      members: guild.memberCount,
      messages: totals[0]?.totalMessages ?? 0,
      voiceCompletedSeconds: totals[0]?.totalVoiceSeconds ?? 0,
      voiceActiveEstimatedSeconds: sessions.reduce((sum, session) => sum + getActiveVoiceSeconds(session, now), 0),
      updatedAt: now.toISOString()
    };
  })();
  cache.set(guild.id, { expiresAt: now.getTime() + CACHE_MS, promise });
  if (cache.size > 500) cache.delete(cache.keys().next().value!);
  void promise.catch(() => { if (cache.get(guild.id)?.promise === promise) cache.delete(guild.id); });
  return promise;
}
