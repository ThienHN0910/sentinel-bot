import { EmbedBuilder, type ChatInputCommandInteraction } from 'discord.js';
import { getServerStats } from '../services/analytics/ServerStatsService';
import { withQueryTimeout } from './queryTimeout';

function formatDuration(seconds: number): string {
  const minutes = Math.floor(seconds / 60);
  return `${Math.floor(minutes / 60)} giờ ${minutes % 60} phút`;
}

export async function handleServerStatsCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guild) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
    return;
  }
  await interaction.deferReply();
  try {
    const stats = await withQueryTimeout(getServerStats(interaction.guild), 8_000);
    const frontend = (process.env.FRONTEND_URL || 'https://sentinel-dashboard.thienhn.io.vn').replace(/\/$/, '');
    const embed = new EmbedBuilder()
      .setTitle(`Hoạt động ${interaction.guild.name}`)
      .setDescription('Số liệu cộng dồn từ khi Sentinel bắt đầu ghi nhận hoạt động trong server.')
      .addFields(
        { name: 'Thành viên hiện tại', value: stats.members.toLocaleString('vi-VN'), inline: true },
        { name: 'Tin nhắn đã ghi nhận', value: stats.messages.toLocaleString('vi-VN'), inline: true },
        { name: 'Voice đã lưu', value: formatDuration(stats.voiceCompletedSeconds), inline: true },
        { name: 'Voice đang tham gia (ước tính)', value: formatDuration(stats.voiceActiveEstimatedSeconds), inline: true }
      )
      .setFooter({ text: `Cập nhật ${new Date(stats.updatedAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })}` });
    await interaction.editReply({ content: `${frontend}/dashboard?guild=${encodeURIComponent(interaction.guild.id)}`, embeds: [embed] });
  } catch {
    await interaction.editReply('Hiện không tải được thống kê server. Vui lòng thử lại sau.');
  }
}
