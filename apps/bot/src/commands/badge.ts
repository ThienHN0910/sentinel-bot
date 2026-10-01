import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder
} from 'discord.js';
import { BADGE_CATALOG, BadgeService, type UserBadgesSummary } from '../services/badge/BadgeService.js';

export const badgeSlashCommand = new SlashCommandBuilder()
  .setName('badge')
  .setDescription('Xem và trang bị danh hiệu / huy hiệu thành tựu')
  .addSubcommand((sub) =>
    sub
      .setName('list')
      .setDescription('Xem danh sách huy hiệu đã mở khóa và tiến độ mở khóa')
  )
  .addSubcommand((sub) =>
    sub
      .setName('equip')
      .setDescription('Trang bị một huy hiệu đã mở khóa vào danh hiệu cá nhân')
      .addStringOption((opt) =>
        opt
          .setName('id')
          .setDescription('Mã định danh của huy hiệu (vd: chatter_100, streak_7)')
          .setRequired(true)
          .addChoices(
            ...BADGE_CATALOG.map((b) => ({
              name: `${b.emoji} ${b.name} (${b.id})`,
              value: b.id
            }))
          )
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('unequip')
      .setDescription('Tháo huy hiệu đang trang bị')
  );

/**
 * Creates Discord embed displaying user unlocked and locked badge progression.
 */
export function createBadgeListEmbed(username: string, summary: UserBadgesSummary): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTitle(`🎖️ Bộ Sưu Tập Huy Hiệu — ${username}`)
    .setColor('#5865F2')
    .setTimestamp();

  const equippedText = summary.equippedBadge
    ? `${summary.equippedBadge.emoji} **${summary.equippedBadge.name}** (\`${summary.equippedBadge.id}\`)`
    : '*(Chưa trang bị)*';

  embed.setDescription(
    `✨ **Đang trang bị:** ${equippedText}\n` +
      `🏆 **Tiến độ tổng:** **${summary.unlockedCount}/${summary.totalCount}** huy hiệu đã sở hữu\n` +
      `──────────────────────────────`
  );

  if (summary.unlocked.length > 0) {
    const unlockedLines = summary.unlocked
      .map((b) => `${b.emoji} **${b.name}** (\`${b.id}\`)\n┗ *${b.description}*`)
      .join('\n');
    embed.addFields({
      name: `🔓 Đã mở khóa (${summary.unlocked.length})`,
      value: unlockedLines
    });
  } else {
    embed.addFields({
      name: '🔓 Đã mở khóa (0)',
      value: 'Chưa mở khóa huy hiệu nào. Hãy tham gia chat, voice và hoạt động trong server nhé!'
    });
  }

  if (summary.locked.length > 0) {
    const lockedLines = summary.locked
      .map(
        (b) =>
          `🔒 **${b.name}** ${b.emoji} (\`${b.id}\`)\n┗ ${b.description} — *Tiến độ: ${b.progressText}*`
      )
      .join('\n');
    embed.addFields({
      name: `🔒 Chưa mở khóa (${summary.locked.length})`,
      value: lockedLines
    });
  } else {
    embed.addFields({
      name: '🔒 Chưa mở khóa',
      value: '🎉 Tuyệt vời! Bạn đã xuất sắc mở khóa toàn bộ huy hiệu thành tựu server!'
    });
  }

  embed.setFooter({ text: 'Dùng lệnh /badge equip id:<mã> để trang bị danh hiệu yêu thích!' });
  return embed;
}

/**
 * Handles /badge slash commands.
 */
export async function handleBadgeCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const guildId = interaction.guildId;
  if (!guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng được trong server!', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const callerId = interaction.user.id;

  if (subcommand === 'list') {
    await interaction.deferReply();
    const summary = await BadgeService.getUserBadges(guildId, callerId);
    const embed = createBadgeListEmbed(interaction.user.username, summary);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  if (subcommand === 'equip') {
    await interaction.deferReply();
    const badgeId = interaction.options.getString('id', true);
    try {
      const result = await BadgeService.equipBadge(guildId, callerId, badgeId);
      await interaction.editReply({
        content: `✨ Bạn đã trang bị huy hiệu **${result.badge.emoji} ${result.badge.name}** thành công!`
      });
    } catch (err: any) {
      await interaction.editReply({
        content: `❌ ${err.message || 'Không thể trang bị huy hiệu này!'}`
      });
    }
    return;
  }

  if (subcommand === 'unequip') {
    await interaction.deferReply();
    await BadgeService.unequipBadge(guildId, callerId);
    await interaction.editReply({
      content: '✨ Bạn đã tháo huy hiệu thành công!'
    });
    return;
  }
}
