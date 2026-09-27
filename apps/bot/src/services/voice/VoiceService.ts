import mongoose from 'mongoose';
import { VoiceState } from 'discord.js';
import { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } from '@discordjs/voice';
import { UserStatModel } from '../../models/UserStat';
import { VoiceSessionModel } from '../../models/VoiceSession';
import { GuildConfigModel } from '../../models/GuildConfig';
import { getVietnameseTtsStream } from './ttsStream';
import { recordActivity } from '../analytics/activity';

// Kept as a local hint for older callers; MongoDB is the source of truth.
export const activeVoiceSessions = new Map<string, number>();
const pendingByUser = new Map<string, Promise<void>>();
interface PendingVoiceEvent {
  guildId: string;
  userId: string;
  oldChannelId: string | null;
  channelId: string | null;
  sessionId: string | null;
  observedAt: Date;
  identity: { username: string; avatar: string };
  state: VoiceState;
}
export const pendingVoiceEvents = new Map<string, PendingVoiceEvent[]>();

export async function runVoiceKeyed(guildId: string, userId: string, action: () => Promise<void>): Promise<void> {
  const key = `${guildId}:${userId}`;
  const previous = pendingByUser.get(key) ?? Promise.resolve();
  const current = previous.catch(() => undefined).then(action);
  pendingByUser.set(key, current);
  try {
    await current;
  } finally {
    if (pendingByUser.get(key) === current) pendingByUser.delete(key);
  }
}

export function calculateVoiceRewards(durationSeconds: number) {
  const intervals = Math.floor(durationSeconds / 300);
  return { exp: intervals * 10, coins: intervals * 5 };
}

async function flushVoiceEventsForKey(guildId: string, userId: string): Promise<void> {
  const key = `${guildId}:${userId}`;
  await runVoiceKeyed(guildId, userId, async () => {
    const events = pendingVoiceEvents.get(key);
    while (events?.length) {
      const event = events[0];
      try {
        if (event.channelId) {
          const previous = await VoiceSessionModel.findOne({ guildId, userId });
          if (previous?.sessionId && event.sessionId && previous.sessionId !== event.sessionId) {
            await VoiceService.settleSession(guildId, userId, previous.lastObservedAt);
          }
          await VoiceService.startSession(guildId, userId, event.channelId, event.sessionId, event.observedAt);
        } else {
          await VoiceService.settleSession(guildId, userId, event.observedAt, event.identity);
        }
        events.shift();
        if (events.length === 0) pendingVoiceEvents.delete(key);
      } catch (error) {
        console.error('[Voice] Lifecycle update failed; will retry:', error);
        break;
      }
      if (event.channelId && !event.oldChannelId) {
        try {
          await recordActivity(guildId, 'voiceJoins', event.observedAt);
          const config = await GuildConfigModel.findOne({ guildId });
          if (config?.welcomeVoiceTts) {
            const welcomeText = (config.welcomeMessage || 'Chào mừng {user}').replace(
              '{user}', event.state.member?.displayName || 'thành viên'
            );
            void VoiceService.playGreeting(event.state, welcomeText).catch(console.error);
          }
        } catch (error) {
          console.error('[Voice] Greeting or activity update failed:', error);
        }
      }
    }
  });
}

export async function retryPendingVoiceEvents(): Promise<void> {
  const keys = [...pendingVoiceEvents.keys()];
  for (let offset = 0; offset < keys.length; offset += 50) {
    await Promise.all(keys.slice(offset, offset + 50).map((key) => {
      const separator = key.indexOf(':');
      return flushVoiceEventsForKey(key.slice(0, separator), key.slice(separator + 1));
    }));
  }
}

export class VoiceService {
  public static async startSession(guildId: string, userId: string, channelId: string, sessionId: string | null, now = new Date()) {
    await VoiceSessionModel.findOneAndUpdate(
      { guildId, userId },
      { $setOnInsert: { guildId, userId, startedAt: now }, $set: { channelId, sessionId, lastObservedAt: now } },
      { upsert: true }
    );
    activeVoiceSessions.set(`${guildId}:${userId}`, now.getTime());
  }

  public static async settleSession(
    guildId: string,
    userId: string,
    endedAt = new Date(),
    identity?: { username: string; avatar: string }
  ) {
    const dbSession = await mongoose.startSession();
    try {
      await dbSession.withTransaction(async () => {
        const voice = await VoiceSessionModel.findOne({ guildId, userId }).session(dbSession);
        if (!voice) return;
        const durationSeconds = Math.max(0, Math.floor((endedAt.getTime() - voice.startedAt.getTime()) / 1000));
        const rewards = calculateVoiceRewards(durationSeconds);
        await UserStatModel.findOneAndUpdate(
          { guildId, userId },
          {
            $inc: { totalVoiceSeconds: durationSeconds, exp: rewards.exp, dneCoins: rewards.coins },
            $set: { updatedAt: endedAt, ...(identity ? { username: identity.username, avatar: identity.avatar } : {}) },
            ...(identity ? {} : { $setOnInsert: { username: 'User' } })
          },
          { upsert: true, session: dbSession }
        );
        await VoiceSessionModel.deleteOne({ guildId, userId }, { session: dbSession });
      });
      activeVoiceSessions.delete(`${guildId}:${userId}`);
    } finally {
      await dbSession.endSession();
    }
  }

  public static async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState, observedAt = new Date()) {
    const userId = newState.id || oldState.id;
    const guildId = newState.guild.id || oldState.guild.id;
    if (newState.member?.user.bot || oldState.member?.user.bot) return;
    if (oldState.channelId === newState.channelId) return;
    const key = `${guildId}:${userId}`;
    const events = pendingVoiceEvents.get(key) ?? [];
    events.push({
      guildId, userId,
      oldChannelId: oldState.channelId,
      channelId: newState.channelId,
      sessionId: newState.sessionId,
      observedAt,
      identity: {
        username: oldState.member?.user.username || newState.member?.user.username || 'User',
        avatar: oldState.member?.user.displayAvatarURL?.() || newState.member?.user.displayAvatarURL?.() || ''
      },
      state: newState
    });
    pendingVoiceEvents.set(key, events);
    await flushVoiceEventsForKey(guildId, userId);
  }

  public static async playGreeting(state: VoiceState, message: string) {
    if (!state.channel) return;
    const connection = joinVoiceChannel({
      channelId: state.channel.id,
      guildId: state.guild.id,
      adapterCreator: state.guild.voiceAdapterCreator as any
    });
    const player = createAudioPlayer();
    const stream = getVietnameseTtsStream(message);
    const resource = createAudioResource(stream);
    player.play(resource);
    connection.subscribe(player);
    player.on(AudioPlayerStatus.Idle, () => {
      player.stop();
      connection.destroy();
    });
    player.on('error', () => connection.destroy());
  }
}
