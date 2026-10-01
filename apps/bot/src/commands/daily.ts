import {
  EmbedBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { EconomyService } from '../services/economy/EconomyService';

export function renderStreakBar(streak: number, maxStreak = 7): string {
  const clamped = Math.max(0, Math.min(streak, maxStreak));
  const filled = '█'.repeat(clamped);
  const empty = '░'.repeat(maxStreak - clamped);
  return `🔥 Chuỗi: ${clamped}/${maxStreak} ngày [${filled}${empty}]`;
}

export function formatCooldownTime(hours: number, minutes: number): string {
  if (hours > 0) {
    return `${hours} giờ ${minutes} phút`;
  }
  return `${minutes} phút`;
}

export function createDailyEmbed(streak: number, rewardCoins: number, totalCoins?: number): EmbedBuilder {
  const streakBar = renderStreakBar(streak);
  const embed = new EmbedBuilder()
    .setTitle('✨ Điểm Danh Hằng Ngày')
    .setDescription(`Chúc mừng bạn đã điểm danh thành công!\n\n${streakBar}`)
    .setColor(0x00e676)
    .addFields(
      { name: 'Phần thưởng', value: `+${rewardCoins} DNE Coins`, inline: true },
      ...(totalCoins !== undefined
        ? [{ name: 'Tổng số dư', value: `${totalCoins.toLocaleString('vi-VN')} DNE Coins`, inline: true }]
        : [])
    )
    .setFooter({
      text: streak >= 7
        ? '🔥 Bạn đã đạt chuỗi tối đa 7 ngày! Duy trì mỗi ngày để nhận thưởng cao nhất.'
        : '💡 Điểm danh liên tục để nhận thêm bonus DNE Coins mỗi ngày!'
    });

  return embed;
}

export function createCooldownEmbed(
  hoursRemaining: number,
  minutesRemaining: number,
  currentStreak = 0
): EmbedBuilder {
  const remainingTimeStr = formatCooldownTime(hoursRemaining, minutesRemaining);
  const streakBar = renderStreakBar(currentStreak);

  const embed = new EmbedBuilder()
    .setTitle('⏳ Điểm danh hằng ngày')
    .setDescription(
      `Bạn đã nhận thưởng điểm danh hôm nay rồi!\nHãy quay lại sau: **${remainingTimeStr}**\n\n${streakBar}`
    )
    .setColor(0xffa500)
    .addFields(
      { name: 'Thời gian còn lại', value: remainingTimeStr, inline: true },
      { name: 'Chuỗi hiện tại', value: `${currentStreak}/7 ngày`, inline: true }
    )
    .setFooter({ text: 'Mỗi lượt điểm danh cách nhau tối thiểu 20 giờ.' });

  return embed;
}

export async function handleDailyCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const guildId = interaction.guildId;
    const userId = interaction.user.id;
    const username = interaction.user.username;

    const status = await EconomyService.getDailyStatus(guildId, userId);
    if (!status.canClaim) {
      const cooldownEmbed = createCooldownEmbed(status.hoursRemaining, status.minutesRemaining, status.currentStreak);
      await interaction.editReply({ embeds: [cooldownEmbed] });
      return;
    }

    const result = await EconomyService.claimDaily(guildId, userId, username);
    const successEmbed = createDailyEmbed(result.streak, result.reward, result.totalCoins);
    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error: any) {
    if (error.message?.includes('Bạn đã nhận điểm danh hôm nay rồi')) {
      const status = await EconomyService.getDailyStatus(interaction.guildId, interaction.user.id);
      const cooldownEmbed = createCooldownEmbed(status.hoursRemaining, status.minutesRemaining, status.currentStreak);
      await interaction.editReply({ embeds: [cooldownEmbed] });
      return;
    }

    console.error('[Daily] Failed to handle daily command:', error);
    await interaction.editReply({ content: 'Hiện không thể thực hiện điểm danh. Vui lòng thử lại sau.' });
  }
}
