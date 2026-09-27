import type { Client, VoiceState } from 'discord.js';
import { VoiceSessionModel } from '../../models/VoiceSession';
import { VoiceService, runVoiceKeyed } from './VoiceService';

function trackedStates(client: Client) {
  const states = new Map<string, VoiceState>();
  for (const guild of client.guilds.cache.values()) {
    for (const state of guild.voiceStates.cache.values()) {
      if (state.channelId && !state.member?.user.bot) states.set(`${guild.id}:${state.id}`, state);
    }
  }
  return states;
}

export async function reconcileVoiceSessions(client: Client, now = new Date()): Promise<void> {
  const saved = await VoiceSessionModel.find({});
  const current = trackedStates(client);
  const keys = new Set([...saved.map((session) => `${session.guildId}:${session.userId}`), ...current.keys()]);
  for (const key of keys) {
    const separator = key.indexOf(':');
    const guildId = key.slice(0, separator);
    const userId = key.slice(separator + 1);
    await runVoiceKeyed(guildId, userId, async () => {
      // Read both sources after acquiring the per-user lock; gateway events may race with startup.
      const voice = await VoiceSessionModel.findOne({ guildId, userId });
      const live = trackedStates(client).get(key);
      if (voice && !live) {
        await VoiceService.settleSession(guildId, userId, voice.lastObservedAt);
      } else if (voice && live && voice.sessionId && live.sessionId && voice.sessionId !== live.sessionId) {
        await VoiceService.settleSession(guildId, userId, voice.lastObservedAt);
        await VoiceService.startSession(guildId, userId, live.channelId!, live.sessionId, now);
      } else if (!voice && live) {
        await VoiceService.startSession(guildId, userId, live.channelId!, live.sessionId, now);
      }
    });
  }
}

export function startVoiceObservation(client: Client, intervalMs = 60_000): () => void {
  let running = false;
  const timer = setInterval(async () => {
    if (running) return;
    running = true;
    try {
      const now = new Date();
      const states = [...trackedStates(client).values()];
      for (let index = 0; index < states.length; index += 100) {
        const batch = states.slice(index, index + 100);
        await VoiceSessionModel.bulkWrite(batch.map((state) => ({
          updateOne: {
            filter: { guildId: state.guild.id, userId: state.id, sessionId: state.sessionId },
            update: { $set: { lastObservedAt: now, channelId: state.channelId! } }
          }
        })));
      }
    } catch (error) {
      console.error('[Voice] Observation update failed; will retry:', error);
    } finally {
      running = false;
    }
  }, intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
