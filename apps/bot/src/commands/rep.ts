import {
  EmbedBuilder,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
  type User
} from 'discord.js';
import { RepService } from '../services/economy/RepService';

export const repSlashCommand = new SlashCommandBuilder()
  .setName('rep')
  .setDescription('Cộng điểm uy tín / danh tiếng (+rep) cho thành viên khác')
  .addUserOption((opt) =>
    opt.setName('user').setDescription('Thành viên bạn muốn +rep').setRequired(true)
  )
  .addStringOption((opt) =>
    opt.setName('reason').setDescription('Lý do +rep (không bắt buộc)').setRequired(false)
  );

export function createRepSuccessEmbed(params: {
  giverId: string;
  receiver: {
    id: string;
    username?: string;
    displayAvatarURL?: () => string;
  };
  receiverRepCount: number;
  giverRemaining: number;
  reason?: string;
}): EmbedBuilder {
  const truncatedReason = params.reason
    ? (params.reason.length > 200 ? params.reason.slice(0, 200) : params.reason)
    : undefined;

  const embed = new EmbedBuilder()
    .setTitle('🌟 Điểm Uy Tín (+rep)')
    .setDescription(`<@${params.giverId}> đã cộng +1 điểm uy tín cho <@${params.receiver.id}>!`)
    .setColor(0xf1c40f)
    .addFields(
      ...(truncatedReason ? [{ name: 'Lý do', value: truncatedReason, inline: false }] : []),
      { name: '⭐ Tổng điểm uy tín', value: `**${params.receiverRepCount}** điểm`, inline: true },
      { name: '⭐ Lượt còn lại hôm nay', value: `Còn lại **${params.giverRemaining}/3** lượt`, inline: true }
    )
    .setFooter({ text: 'Mỗi thành viên có tối đa 3 lượt +rep mỗi ngày (reset lúc 00:00 UTC+7).' });

  if (typeof params.receiver.displayAvatarURL === 'function') {
    embed.setThumbnail(params.receiver.displayAvatarURL());
  }

  return embed;
}

export function createRepErrorEmbed(errorMessage: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ Không thể +rep')
    .setDescription(errorMessage)
    .setColor(0xed4245);
}

export async function handleRepCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  // Reject execution outside a guild (DM)
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
    return;
  }

  const targetUser: User | null =
    interaction.options.getUser('user') || interaction.options.getUser('target');

  if (!targetUser) {
    await interaction.reply({ content: 'Vui lòng chọn người dùng bạn muốn +rep!', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  try {
    const rawReason = interaction.options.getString('reason')?.trim() || undefined;
    const reason = rawReason && rawReason.length > 200 ? rawReason.slice(0, 200) : rawReason;

    const result = await RepService.giveRep({
      guildId: interaction.guildId,
      giverId: interaction.user.id,
      giverUsername: interaction.user.username,
      receiverId: targetUser.id,
      receiverUsername: targetUser.username,
      reason
    });

    if (!result.success) {
      const errorEmbed = createRepErrorEmbed(result.error || 'Không thể thực hiện +rep.');
      await interaction.editReply({ embeds: [errorEmbed] });
      return;
    }

    const successEmbed = createRepSuccessEmbed({
      giverId: interaction.user.id,
      receiver: targetUser,
      receiverRepCount: result.receiverRepCount,
      giverRemaining: result.giverRemaining,
      reason
    });

    await interaction.editReply({ embeds: [successEmbed] });
  } catch (error) {
    console.error('[Rep] Failed to handle /rep command:', error);
    await interaction.editReply({ content: 'Hiện không thể thực hiện +rep. Vui lòng thử lại sau.' });
  }
}
