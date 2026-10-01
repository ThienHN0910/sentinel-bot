import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction
} from 'discord.js';
import { GachaRarity, GachaResult } from '@sentinel/shared';
import { GachaService } from '../services/economy/GachaService';

export const gachaSlashCommand = new SlashCommandBuilder()
  .setName('gacha')
  .setDescription('Vòng quay may mắn DNE Gacha')
  .addSubcommand((subcommand) =>
    subcommand
      .setName('spin')
      .setDescription('Quay gacha may mắn (miễn phí mỗi 24h hoặc 200 DNE Coins)')
  );

export const GACHA_COLORS: Record<GachaRarity, number> = {
  COMMON: 0x9e9e9e,
  UNCOMMON: 0x4caf50,
  RARE: 0x2196f3,
  EPIC: 0x9c27b0,
  LEGENDARY: 0xffd700
};

export const GACHA_RARITY_LABELS: Record<GachaRarity, string> = {
  COMMON: '⚪ Thường (Common)',
  UNCOMMON: '🟢 Hiếm (Uncommon)',
  RARE: '🔵 Quý (Rare)',
  EPIC: '🟣 Sử Thi (Epic)',
  LEGENDARY: '🟡 Huyền Thoại (Legendary)'
};

export function createGachaResultEmbed(params: {
  userId: string;
  result: GachaResult;
  avatarUrl?: string;
}): EmbedBuilder {
  const { userId, result, avatarUrl } = params;
  const rarityLabel = GACHA_RARITY_LABELS[result.rarity] || result.rarity;
  const color = GACHA_COLORS[result.rarity] || 0x9e9e9e;

  const rarityValue = result.isPityGuaranteed
    ? `**${rarityLabel}** (🎯 Bảo hiểm kích hoạt!)`
    : `**${rarityLabel}**`;

  const rewardText = result.rewardXp > 0
    ? `+${result.rewardCoins} DNE Coins & +${result.rewardXp} XP`
    : `+${result.rewardCoins} DNE Coins`;

  const costText = result.isFree ? 'Miễn phí (Hằng ngày)' : '200 DNE Coins';

  const embed = new EmbedBuilder()
    .setTitle('🎰 Vòng Quay May Mắn (DNE Gacha)')
    .setDescription(`<@${userId}> đã thực hiện quay Gacha!`)
    .setColor(color)
    .addFields(
      { name: '✨ Phẩm cấp', value: rarityValue, inline: true },
      { name: '🎁 Phần thưởng', value: rewardText, inline: true },
      { name: '💰 Chi phí', value: costText, inline: true },
      { name: '💳 Số dư mới', value: `${result.newBalance.toLocaleString('vi-VN')} DNE Coins`, inline: true },
      { name: '🎯 Bảo hiểm (Pity)', value: `🎯 Tiến trình bảo hiểm: **${result.pity}/50**`, inline: true }
    )
    .setFooter({
      text: 'Quay miễn phí mỗi 24 giờ. Bảo hiểm 50 lượt đảm bảo nhận Sử Thi hoặc Huyền Thoại!'
    });

  if (avatarUrl) {
    embed.setThumbnail(avatarUrl);
  }

  return embed;
}

export function createGachaErrorEmbed(errorMessage: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ Không thể quay Gacha')
    .setDescription(errorMessage)
    .setColor(0xed4245);
}

export async function handleGachaCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const avatarUrl = typeof interaction.user.displayAvatarURL === 'function'
      ? interaction.user.displayAvatarURL()
      : undefined;

    const result = await GachaService.spin({
      guildId: interaction.guildId,
      userId: interaction.user.id,
      username: interaction.user.username
    });

    const embed = createGachaResultEmbed({
      userId: interaction.user.id,
      result,
      avatarUrl
    });

    await interaction.editReply({ embeds: [embed] });
  } catch (error: any) {
    const message = error?.message || 'Có lỗi xảy ra khi thực hiện quay Gacha. Vui lòng thử lại sau.';
    const errorEmbed = createGachaErrorEmbed(message);
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}
