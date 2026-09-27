import { VoiceState } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus
} from '@discordjs/voice';
import { UserStatModel } from '../../models/UserStat';
import { GuildConfigModel } from '../../models/GuildConfig';
import { getVietnameseTtsStream } from './ttsStream';

export const activeVoiceSessions = new Map<string, number>(); // `${guildId}:${userId}` -> timestamp

export function calculateVoiceRewards(durationSeconds: number) {
  const intervals = Math.floor(durationSeconds / 300); // every 5 mins
  return {
    exp: intervals * 10,
    coins: intervals * 5
  };
}

export class VoiceService {
  public static async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const userId = newState.id || oldState.id;
    const guildId = newState.guild.id || oldState.guild.id;
    if (newState.member?.user.bot) return;

    const sessionKey = `${guildId}:${userId}`;

    // 1. User Joined Voice Channel
    if (!oldState.channelId && newState.channelId) {
      activeVoiceSessions.set(sessionKey, Date.now());

      // Trigger TTS Greeting
      const config = await GuildConfigModel.findOne({ guildId });
      if (config?.welcomeVoiceTts) {
        const welcomeText = (config.welcomeMessage || 'Chào mừng {user}').replace(
          '{user}',
          newState.member?.displayName || 'thành viên'
        );
        VoiceService.playGreeting(newState, welcomeText);
      }
    }

    // 2. User Left Voice Channel
    if (oldState.channelId && !newState.channelId) {
      const joinTime = activeVoiceSessions.get(sessionKey);
      if (joinTime) {
        const durationSeconds = Math.floor((Date.now() - joinTime) / 1000);
        activeVoiceSessions.delete(sessionKey);

        const rewards = calculateVoiceRewards(durationSeconds);

        await UserStatModel.findOneAndUpdate(
          { guildId, userId },
          {
            $inc: {
              totalVoiceSeconds: durationSeconds,
              exp: rewards.exp,
              dneCoins: rewards.coins
            },
            $set: {
              username: oldState.member?.user.username || 'User',
              avatar: oldState.member?.user.displayAvatarURL() || '',
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }
    }
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

    player.on('error', () => {
      connection.destroy();
    });
  }
}
