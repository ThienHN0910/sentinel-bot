import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ButtonInteraction,
  type ChatInputCommandInteraction
} from 'discord.js';
import { IBet } from '@sentinel/shared';
import { BetService } from '../services/betting/BetService';

export const betSlashCommand = new SlashCommandBuilder()
  .setName('bet')
  .setDescription('Hệ thống đặt cược: Thách đấu 1v1 P2P & Kèo cộng đồng')
  .addSubcommand((sub) =>
    sub
      .setName('challenge')
      .setDescription('Tạo kèo thách đấu 1v1 với một thành viên khác')
      .addUserOption((opt) => opt.setName('user').setDescription('Đối thủ bạn muốn thách đấu').setRequired(true))
      .addIntegerOption((opt) => opt.setName('amount').setDescription('Số xu DNE Coins cược').setMinValue(1).setRequired(true))
      .addStringOption((opt) => opt.setName('title').setDescription('Tiêu đề kèo cược').setRequired(true))
      .addStringOption((opt) => opt.setName('pick').setDescription('Lựa chọn / dự đoán của bạn').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('accept')
      .setDescription('Chấp nhận kèo thách đấu 1v1')
      .addStringOption((opt) => opt.setName('id').setDescription('Mã ID kèo cược').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('cancel')
      .setDescription('Hủy hoặc từ chối kèo thách đấu 1v1 (hoàn lại xu cược)')
      .addStringOption((opt) => opt.setName('id').setDescription('Mã ID kèo cược').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('pool-create')
      .setDescription('Tạo kèo cộng đồng mở cho nhiều người tham gia')
      .addStringOption((opt) => opt.setName('title').setDescription('Tiêu đề kèo cược cộng đồng').setRequired(true))
      .addStringOption((opt) =>
        opt
          .setName('options')
          .setDescription('Các lựa chọn, cách nhau bằng dấu phẩy (VD: T1, GenG, BLG)')
          .setRequired(true)
      )
      .addStringOption((opt) =>
        opt
          .setName('duration')
          .setDescription('Thời gian mở cược (VD: 30m, 1h, 2h, 1d)')
          .setRequired(true)
      )
  )
  .addSubcommand((sub) =>
    sub
      .setName('pool-join')
      .setDescription('Tham gia đặt cược vào kèo cộng đồng')
      .addStringOption((opt) => opt.setName('id').setDescription('Mã ID kèo cược').setRequired(true))
      .addStringOption((opt) => opt.setName('option').setDescription('Lựa chọn bạn muốn đặt cược').setRequired(true))
      .addIntegerOption((opt) => opt.setName('amount').setDescription('Số xu DNE Coins cược').setMinValue(1).setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('pool-resolve')
      .setDescription('Phân định kết quả kèo cộng đồng (Admin hoặc Người tạo)')
      .addStringOption((opt) => opt.setName('id').setDescription('Mã ID kèo cược').setRequired(true))
      .addStringOption((opt) => opt.setName('winner').setDescription('Lựa chọn chiến thắng').setRequired(true))
  )
  .addSubcommand((sub) =>
    sub
      .setName('p2p-resolve')
      .setDescription('Phân định kết quả thách đấu 1v1 (Admin hoặc Người tạo)')
      .addStringOption((opt) => opt.setName('id').setDescription('Mã ID kèo cược').setRequired(true))
      .addUserOption((opt) => opt.setName('winner').setDescription('Người chiến thắng').setRequired(true))
  );

/**
 * Parses duration strings like "30m", "1h", "2h", "1d" into milliseconds.
 */
export function parseDuration(durationStr: string): number {
  const match = durationStr.trim().match(/^(\d+)\s*(m|min|mins|minute|minutes|h|hour|hours|d|day|days)?$/i);
  if (!match) {
    throw new Error('Định dạng thời gian không hợp lệ! Ví dụ hợp lệ: 30m, 1h, 2h, 1d.');
  }

  const value = parseInt(match[1], 10);
  if (isNaN(value) || value <= 0) {
    throw new Error('Thời gian phải lớn hơn 0!');
  }

  const unit = (match[2] || 'm').toLowerCase();
  if (unit.startsWith('h')) {
    return value * 60 * 60 * 1000;
  }
  if (unit.startsWith('d')) {
    return value * 24 * 60 * 60 * 1000;
  }
  // Default to minutes
  return value * 60 * 1000;
}

export function createP2PChallengeEmbed(bet: IBet): EmbedBuilder {
  const isAccepted = bet.status === 'active';
  const color = isAccepted ? 0x2ecc71 : 0xf39c12;
  const statusLabel =
    bet.status === 'open'
      ? '⏳ Đang chờ đối thủ chấp nhận'
      : bet.status === 'active'
      ? '⚔️ Đang diễn ra'
      : bet.status === 'resolved'
      ? '🏆 Đã có kết quả'
      : '❌ Đã hủy';

  const embed = new EmbedBuilder()
    .setTitle(`🎲 THÁCH ĐẤU 1V1: ${bet.title}`)
    .setDescription(`Mã Kèo: \`${bet.betId}\`\nTrạng thái: **${statusLabel}**`)
    .setColor(color)
    .addFields(
      { name: 'Người thách đấu', value: `<@${bet.creatorId}> (\`${bet.creatorUsername}\`)`, inline: true },
      {
        name: 'Đối thủ',
        value: bet.opponentId ? `<@${bet.opponentId}>` : bet.opponentUsername || 'Mọi người',
        inline: true
      },
      { name: 'Mức cược mỗi bên', value: `${(bet.wagers[0]?.amount || 0).toLocaleString('vi-VN')} xu`, inline: true },
      { name: 'Tổng hũ cược', value: `💰 **${bet.totalPool.toLocaleString('vi-VN')} DNE Coins**`, inline: true },
      { name: 'Lựa chọn của người tạo', value: `🎯 ${bet.options[0]}`, inline: true },
      { name: 'Lựa chọn của đối thủ', value: `🎯 ${bet.options[1] || 'Đối đầu'}`, inline: true },
      { name: 'Thời hạn', value: `<t:${Math.floor(new Date(bet.expiresAt).getTime() / 1000)}:R>`, inline: false }
    )
    .setFooter({ text: 'Dùng các nút bên dưới hoặc lệnh /bet accept/cancel để phản hồi.' });

  return embed;
}

export function createPoolEmbed(bet: IBet): EmbedBuilder {
  const isResolved = bet.status === 'resolved';
  const color = isResolved ? 0x9b59b6 : 0x3498db;
  const statusLabel =
    bet.status === 'open'
      ? '🟢 Đang mở đặt cược'
      : bet.status === 'resolved'
      ? '🏆 Đã đóng & có kết quả'
      : '❌ Đã hủy';

  const embed = new EmbedBuilder()
    .setTitle(`🎪 KÈO CỘNG ĐỒNG: ${bet.title}`)
    .setDescription(`Mã Kèo: \`${bet.betId}\`\nTrạng thái: **${statusLabel}**\nNgười tạo: <@${bet.creatorId}>`)
    .setColor(color)
    .addFields(
      { name: '💰 Tổng hũ cược', value: `**${bet.totalPool.toLocaleString('vi-VN')} DNE Coins**`, inline: true },
      { name: '👥 Tổng lượt cược', value: `${bet.wagers.length} lượt`, inline: true },
      { name: '⏳ Hết hạn nhận cược', value: `<t:${Math.floor(new Date(bet.expiresAt).getTime() / 1000)}:R>`, inline: true },
      {
        name: '📋 Danh sách lựa chọn',
        value: bet.options.map((opt, idx) => `${idx + 1}. **${opt}**`).join('\n'),
        inline: false
      }
    )
    .setFooter({ text: 'Đặt cược bằng lệnh /bet pool-join id:<mã> option:<lựa chọn> amount:<số xu>' });

  return embed;
}

export function createBetActionRow(betId: string): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`bet:p2p:accept:${betId}`)
      .setLabel('Chấp nhận thách đấu')
      .setStyle(ButtonStyle.Success)
      .setEmoji('⚔️'),
    new ButtonBuilder()
      .setCustomId(`bet:p2p:reject:${betId}`)
      .setLabel('Từ chối / Hủy')
      .setStyle(ButtonStyle.Danger)
      .setEmoji('✖️')
  );
}

export function createBetErrorEmbed(message: string): EmbedBuilder {
  return new EmbedBuilder()
    .setTitle('❌ Thao tác không thành công')
    .setDescription(message)
    .setColor(0xed4245);
}

/**
 * Handles /bet slash commands.
 */
export async function handleBetCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
    return;
  }

  const subcommand = interaction.options.getSubcommand();
  const guildId = interaction.guildId;
  const callerId = interaction.user.id;
  const callerUsername = interaction.user.username;
  const creatorUsername = callerUsername;

  const isGuildAdmin = Boolean(
    interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      (interaction.member?.permissions as any)?.has?.(PermissionFlagsBits.ManageGuild) ||
      (interaction.member?.permissions as any)?.has?.('ManageGuild')
  );

  await interaction.deferReply();

  try {
    // ── 1. Thách đấu 1v1 P2P ────────────────────────────────────────────────
    if (subcommand === 'challenge') {
      const targetUser = interaction.options.getUser('user', true);
      const amount = interaction.options.getInteger('amount', true);
      const title = interaction.options.getString('title', true);
      const pick = interaction.options.getString('pick', true);

      const bet = await BetService.createP2PChallenge({
        guildId,
        creatorId: callerId,
        creatorUsername,
        opponentId: targetUser.id,
        opponentUsername: targetUser.username,
        amount,
        title,
        creatorPick: pick
      });

      const embed = createP2PChallengeEmbed(bet);
      const row = createBetActionRow(bet.betId);
      await interaction.editReply({
        content: `⚔️ <@${targetUser.id}>, bạn nhận được lời thách đấu từ <@${callerId}>!`,
        embeds: [embed],
        components: [row]
      });
      return;
    }

    // ── 2. Chấp nhận 1v1 ───────────────────────────────────────────────────
    if (subcommand === 'accept') {
      const betId = interaction.options.getString('id', true).trim();
      const bet = await BetService.acceptP2PChallenge({
        betId,
        opponentId: callerId,
        opponentUsername: callerUsername
      });

      const embed = createP2PChallengeEmbed(bet);
      await interaction.editReply({
        content: `✅ <@${callerId}> đã chấp nhận thách đấu từ <@${bet.creatorId}>! Trận đấu chính thức bắt đầu!`,
        embeds: [embed]
      });
      return;
    }

    // ── 3. Hủy hoặc từ chối 1v1 ───────────────────────────────────────────
    if (subcommand === 'cancel') {
      const betId = interaction.options.getString('id', true).trim();
      const bet = await BetService.rejectOrCancelP2P({ betId, userId: callerId });

      await interaction.editReply({
        content: `🛑 Kèo cược \`${bet.betId}\` đã được hủy / từ chối thành công. Tiền cược đã được hoàn trả về ví!`
      });
      return;
    }

    // ── 4. Tạo Kèo Cộng Đồng ────────────────────────────────────────────────
    if (subcommand === 'pool-create') {
      const title = interaction.options.getString('title', true);
      const optionsRaw = interaction.options.getString('options', true);
      const durationStr = interaction.options.getString('duration', true);

      const options = optionsRaw.split(',').map((o) => o.trim()).filter(Boolean);
      const durationMs = parseDuration(durationStr);

      const bet = await BetService.createCommunityPool({
        guildId,
        creatorId: callerId,
        creatorUsername,
        title,
        options,
        durationMs
      });

      const embed = createPoolEmbed(bet);
      await interaction.editReply({
        content: `📢 Kèo cộng đồng mới đã mở! Hãy tham gia đặt cược ngay!`,
        embeds: [embed]
      });
      return;
    }

    // ── 5. Tham gia Kèo Cộng Đồng ──────────────────────────────────────────
    if (subcommand === 'pool-join') {
      const betId = interaction.options.getString('id', true).trim();
      const option = interaction.options.getString('option', true);
      const amount = interaction.options.getInteger('amount', true);

      const bet = await BetService.joinCommunityPool({
        betId,
        userId: callerId,
        username: callerUsername,
        option,
        amount
      });

      const embed = createPoolEmbed(bet);
      await interaction.editReply({
        content: `🎉 <@${callerId}> đã đặt cược thành công **${amount.toLocaleString('vi-VN')} DNE Coins** vào lựa chọn **"${option}"**!`,
        embeds: [embed]
      });
      return;
    }

    // ── 6. Phân định Kèo Cộng Đồng ─────────────────────────────────────────
    if (subcommand === 'pool-resolve') {
      const betId = interaction.options.getString('id', true).trim();
      const winner = interaction.options.getString('winner', true);

      const result = await BetService.resolveCommunityPool({
        betId,
        callerId,
        isGuildAdmin,
        winningOption: winner
      });

      if (result.refundsGiven) {
        await interaction.editReply({
          content: `⚠️ Kèo cộng đồng \`${betId}\` đã kết thúc với kết quả **"${result.winningOption}"**. Không có người dự đoán đúng, toàn bộ tiền cược đã được hoàn trả lại cho người chơi!`
        });
      } else {
        await interaction.editReply({
          content: `🏆 Kèo cộng đồng \`${betId}\` đã được phân định!\n✨ Lựa chọn chiến thắng: **${result.winningOption}**\n👥 Số người thắng: **${result.totalWinners}**\n💰 Tổng trả thưởng: **${result.totalPayout.toLocaleString('vi-VN')} DNE Coins**!`
        });
      }
      return;
    }

    // ── 7. Phân định Thách đấu 1v1 ─────────────────────────────────────────
    if (subcommand === 'p2p-resolve') {
      const betId = interaction.options.getString('id', true).trim();
      const winnerUser = interaction.options.getUser('winner', true);

      const result = await BetService.resolveP2PChallenge({
        betId,
        callerId,
        isGuildAdmin,
        winnerUserId: winnerUser.id
      });

      await interaction.editReply({
        content: `🏆 Chúc mừng <@${result.winnerId}> đã chiến thắng kèo thách đấu \`${betId}\` và ẵm trọn giải thưởng **${result.payout.toLocaleString('vi-VN')} DNE Coins**!`
      });
      return;
    }
  } catch (error: any) {
    const errorEmbed = createBetErrorEmbed(error.message || 'Có lỗi xảy ra khi thực hiện lệnh cược.');
    await interaction.editReply({ embeds: [errorEmbed] });
  }
}

/**
 * Handles P2P Challenge Button interactions (Accept / Reject).
 */
export async function handleBetButton(interaction: ButtonInteraction): Promise<void> {
  const { customId, user } = interaction;

  if (customId.startsWith('bet:p2p:accept:')) {
    const betId = customId.replace('bet:p2p:accept:', '');
    await interaction.deferReply({ ephemeral: true });

    try {
      await BetService.acceptP2PChallenge({
        betId,
        opponentId: user.id,
        opponentUsername: user.username
      });

      await interaction.editReply({
        content: `⚔️ Bạn đã chấp nhận kèo thách đấu thành công! Chúc bạn may mắn.`
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'Không thể chấp nhận thách đấu.'}`
      });
    }
    return;
  }

  if (customId.startsWith('bet:p2p:reject:')) {
    const betId = customId.replace('bet:p2p:reject:', '');
    await interaction.deferReply({ ephemeral: true });

    try {
      await BetService.rejectOrCancelP2P({
        betId,
        userId: user.id
      });

      await interaction.editReply({
        content: `Đã từ chối / hủy kèo cược thành công. Số xu cược đã được hoàn trả.`
      });
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ ${error.message || 'Không thể từ chối / hủy kèo cược.'}`
      });
    }
    return;
  }
}
