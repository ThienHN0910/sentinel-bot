import type { ChatInputCommandInteraction } from 'discord.js';
import { UserStatModel } from '../models/UserStat';
import { VoiceSessionModel } from '../models/VoiceSession';
import { getUserVoiceSeconds } from '../services/voice/voiceStats';
import { withQueryTimeout } from './queryTimeout';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  return hours > 0 ? `${hours} giờ ${minutes % 60} phút` : `${minutes} phút`;
}

export async function handleStatsCommand(interaction: ChatInputCommandInteraction, timeoutMs = 8_000): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  try {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const [stat, session] = await withQueryTimeout(Promise.all([
      UserStatModel.findOne({ guildId, userId }).lean(),
      VoiceSessionModel.findOne({ guildId, userId }).lean()
    ]), timeoutMs);
    const live = interaction.guild?.voiceStates.cache.has(userId) ? session : null;
    const voice = getUserVoiceSeconds(stat?.totalVoiceSeconds ?? 0, live);
    const content = [
      `Thống kê của ${interaction.user.username} (từ khi bot bắt đầu ghi nhận):`,
      `${stat?.totalMessages ?? 0} tin nhắn`,
      `Voice đã lưu: ${formatDuration(voice.completedSeconds)}`,
      `Voice đang tham gia (ước tính): ${formatDuration(voice.activeEstimatedSeconds)}`,
      `Tổng voice ước tính: ${formatDuration(voice.totalEstimatedSeconds)}`,
      `XP: ${stat?.exp ?? 0} · DNE Coins: ${stat?.dneCoins ?? 0}`,
      ...(!stat && !session ? ['Dữ liệu bắt đầu ghi nhận khi bot quan sát hoạt động của bạn.'] : [])
    ].join('\n');
    await interaction.editReply(content);
  } catch (error) {
    console.error('[Stats] Failed to load member statistics:', error);
    await interaction.editReply('Hiện không tải được thống kê. Vui lòng thử lại sau.');
  }
}
