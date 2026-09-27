import type { ChatInputCommandInteraction } from 'discord.js';
import { UserStatModel } from '../models/UserStat';
import { VoiceSessionModel } from '../models/VoiceSession';
import { getActiveVoiceSeconds } from '../services/voice/voiceStats';
import { withQueryTimeout } from './queryTimeout';

export async function handleLeaderboardCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
    return;
  }
  await interaction.deferReply();
  try {
    const guildId = interaction.guildId;
    const type = interaction.options.getString('type') === 'voice' ? 'voice' : 'chat';
    const field = type === 'voice' ? 'totalVoiceSeconds' : 'totalMessages';
    const users = await withQueryTimeout(UserStatModel.find({ guildId }).sort({ [field]: -1 }).limit(10).lean(), 8_000);
    const scores = new Map(users.map((user) => [user.userId, {
      username: user.username, score: user[field] ?? 0
    }]));
    if (type === 'voice') {
      const sessions = await withQueryTimeout(VoiceSessionModel.find({ guildId }).lean(), 8_000);
      const liveSessions = sessions.filter((session) => interaction.guild?.voiceStates.cache.has(session.userId));
      const missingIds = liveSessions.map((session) => session.userId).filter((id) => !scores.has(id));
      if (missingIds.length) {
        const missing = await withQueryTimeout(UserStatModel.find({ guildId, userId: { $in: missingIds } }).lean(), 8_000);
        for (const user of missing) scores.set(user.userId, { username: user.username, score: user.totalVoiceSeconds });
      }
      for (const session of liveSessions) {
        const previous = scores.get(session.userId);
        const state = interaction.guild?.voiceStates.cache.get(session.userId);
        scores.set(session.userId, {
          username: previous?.username ?? state?.member?.user.username ?? 'User',
          score: (previous?.score ?? 0) + getActiveVoiceSeconds(session)
        });
      }
    }
    const top = [...scores.values()].sort((a, b) => b.score - a.score).slice(0, 10);
    const unit = type === 'voice' ? 'giây voice (gồm phiên đang tham gia, ước tính)' : 'tin nhắn';
    const body = top.length
      ? top.map((user, index) => `${index + 1}. ${user.username}: ${user.score.toLocaleString('vi-VN')} ${unit}`).join('\n')
      : 'Chưa có dữ liệu được ghi nhận.';
    await interaction.editReply(`Top ${type === 'voice' ? 'voice' : 'chat'} từ khi bot ghi nhận:\n${body}`);
  } catch (error) {
    console.error('[Leaderboard] Failed to load ranking:', error);
    await interaction.deleteReply();
    await interaction.followUp({ content: 'Hiện không tải được bảng xếp hạng. Vui lòng thử lại sau.', ephemeral: true });
  }
}
