import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  ModalBuilder,
  PermissionFlagsBits,
  TextInputBuilder,
  TextInputStyle,
  type ButtonInteraction,
  type ChatInputCommandInteraction,
  type Message,
  type ModalSubmitInteraction
} from 'discord.js';
import { ConfessionService } from '../services/confession/ConfessionService.js';
import { GuildConfigModel } from '../models/GuildConfig.js';

export interface PendingDmConfession {
  content: string;
  expiresAt: number;
}

export const pendingDmConfessions = new Map<string, PendingDmConfession>();

export function clearPendingDmConfessions(): void {
  pendingDmConfessions.clear();
}

/**
 * Slash command handler for /confess.
 * Supports /confess send (opens modal), /confess config (sets channel), and /confess delete (admin removal).
 */
export async function handleConfessCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  const subcommand = interaction.options.getSubcommand(false);

  // Administrative channel config: /confess config channel:<#channel>
  if (subcommand === 'config') {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
      return;
    }

    const isAuthorized =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      (interaction.member?.permissions as any)?.has?.(PermissionFlagsBits.ManageGuild) ||
      (interaction.member?.permissions as any)?.has?.('ManageGuild');

    if (!isAuthorized) {
      await interaction.reply({
        content: '❌ Bạn cần có quyền Quản lý Server (Manage Server) để cấu hình kênh confession.',
        ephemeral: true
      });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);

    await GuildConfigModel.findOneAndUpdate(
      { guildId: interaction.guildId },
      {
        $set: { confessionChannelId: channel.id, updatedAt: new Date() },
        $setOnInsert: { name: interaction.guild?.name || 'Server' }
      },
      { upsert: true }
    );

    await interaction.reply({
      content: `✅ Đã cấu hình thành công kênh nhận confession: <#${channel.id}>`,
      ephemeral: true
    });
    return;
  }

  // Administrative deletion: /confess delete id:<number> (or number:<number>)
  if (subcommand === 'delete') {
    if (!interaction.guildId) {
      await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
      return;
    }

    const isAuthorized =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      (interaction.member?.permissions as any)?.has?.(PermissionFlagsBits.ManageGuild) ||
      (interaction.member?.permissions as any)?.has?.('ManageGuild');

    if (!isAuthorized) {
      await interaction.reply({
        content: '❌ Bạn cần có quyền Quản lý Server (Manage Server) để xóa confession.',
        ephemeral: true
      });
      return;
    }

    const confessionNumber = interaction.options.getInteger('id') ?? interaction.options.getInteger('number', true);
    await interaction.deferReply({ ephemeral: true });

    try {
      const deleted = await ConfessionService.deleteConfession({
        guildId: interaction.guildId,
        confessionNumber,
        client: interaction.client
      });

      if (deleted) {
        await interaction.editReply({
          content: `✅ Đã xóa confession #${confessionNumber} thành công.`
        });
      } else {
        await interaction.editReply({
          content: `❌ Không tìm thấy confession #${confessionNumber} hoặc đã bị xóa trước đó.`
        });
      }
    } catch (error: any) {
      await interaction.editReply({
        content: `❌ Lỗi khi xóa confession: ${error.message || 'Lỗi không xác định.'}`
      });
    }
    return;
  }

  // Default: Open submission modal
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
    return;
  }

  const rateLimit = ConfessionService.checkRateLimit(interaction.user.id);
  if (!rateLimit.allowed) {
    await interaction.reply({
      content: `⏳ Bạn cần đợi thêm ${rateLimit.retryAfterSeconds} giây trước khi gửi confession tiếp theo.`,
      ephemeral: true
    });
    return;
  }

  // Reset rate limit peek so modal submission consumes the cooldown accurately
  (ConfessionService as any).userCooldowns?.delete(interaction.user.id);

  const modal = new ModalBuilder()
    .setCustomId('confess_modal')
    .setTitle('Gửi Confession Ẩn Danh');

  const contentInput = new TextInputBuilder()
    .setCustomId('content')
    .setLabel('Nội dung confession')
    .setStyle(TextInputStyle.Paragraph)
    .setPlaceholder('Chia sẻ tâm sự của bạn (tối thiểu 10 ký tự, tối đa 1000 ký tự)...')
    .setMinLength(10)
    .setMaxLength(1000)
    .setRequired(true);

  const actionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(contentInput);
  modal.addComponents(actionRow);

  await interaction.showModal(modal);
}

/**
 * Modal submission handler for confess_modal.
 * Verifies length, checks rate limit, and posts anonymously.
 */
export async function handleConfessModalSubmit(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== 'confess_modal') return;

  if (!interaction.guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const content = interaction.fields.getTextInputValue('content')?.trim();
  if (!content || content.length < 10 || content.length > 1000) {
    await interaction.editReply({ content: '❌ Nội dung confession phải từ 10 đến 1000 ký tự.' });
    return;
  }

  const rateLimit = ConfessionService.checkRateLimit(interaction.user.id);
  if (!rateLimit.allowed) {
    await interaction.editReply({
      content: `⏳ Bạn đang trong thời gian chờ. Vui lòng thử lại sau ${rateLimit.retryAfterSeconds} giây.`
    });
    return;
  }

  try {
    // Zero-Trace Anonymity: never pass user ID or user details
    const result = await ConfessionService.postConfession({
      guildId: interaction.guildId,
      content,
      client: interaction.client
    });

    await interaction.editReply({
      content: `✅ Confession #${result.confessionNumber} của bạn đã được đăng ẩn danh thành công vào kênh!`
    });
  } catch (error: any) {
    await interaction.editReply({
      content: `❌ Không thể đăng confession: ${error.message || 'Lỗi không xác định.'}`
    });
  }
}

/**
 * Button handler for confession actions:
 * - confess:dm_send:<guildId>
 * - confess:dm_cancel
 * - confess:react:heart:<id>
 * - confess:react:laugh:<id>
 * - confess:react:discuss:<id>
 */
export async function handleConfessButton(interaction: ButtonInteraction): Promise<void> {
  const { customId } = interaction;

  // Cancel pending DM draft
  if (customId === 'confess:dm_cancel') {
    pendingDmConfessions.delete(interaction.user.id);
    await interaction.update({
      content: '❌ Đã hủy gửi confession.',
      components: [],
      embeds: []
    });
    return;
  }

  // Publish DM confession to chosen guild
  if (customId.startsWith('confess:dm_send:')) {
    const guildId = customId.split(':')[2];
    const draft = pendingDmConfessions.get(interaction.user.id);

    if (!draft || draft.expiresAt < Date.now()) {
      pendingDmConfessions.delete(interaction.user.id);
      await interaction.reply({
        content: '❌ Yêu cầu đã hết hạn hoặc không tìm thấy bản nháp. Vui lòng gửi lại tin nhắn DM.',
        ephemeral: true
      });
      return;
    }

    const rateLimit = ConfessionService.checkRateLimit(interaction.user.id);
    if (!rateLimit.allowed) {
      await interaction.reply({
        content: `⏳ Bạn đang trong thời gian chờ. Vui lòng thử lại sau ${rateLimit.retryAfterSeconds} giây.`,
        ephemeral: true
      });
      return;
    }

    try {
      // Zero-Trace Anonymity: post without user identification
      const result = await ConfessionService.postConfession({
        guildId,
        content: draft.content,
        client: interaction.client
      });

      pendingDmConfessions.delete(interaction.user.id);

      await interaction.update({
        content: `✅ Confession #${result.confessionNumber} của bạn đã được đăng ẩn danh thành công!`,
        components: [],
        embeds: []
      });
    } catch (error: any) {
      await interaction.reply({
        content: `❌ Không thể đăng confession: ${error.message || 'Lỗi không xác định.'}`,
        ephemeral: true
      });
    }
    return;
  }

  // Handle reaction buttons
  if (customId.startsWith('confess:react:')) {
    const parts = customId.split(':');
    const action = parts[2]; // 'heart' | 'laugh' | 'discuss'

    if (action === 'discuss') {
      await interaction.reply({
        content: '💬 Bạn có thể tạo luồng (thread) hoặc thảo luận trực tiếp bên dưới confession này!',
        ephemeral: true
      });
      return;
    }

    if (action === 'heart' || action === 'laugh') {
      try {
        if (interaction.message?.components) {
          const updatedRows = interaction.message.components.map((row: any) => {
            const newRow = new ActionRowBuilder<ButtonBuilder>();
            for (const comp of row.components) {
              const btn = ButtonBuilder.from(comp);
              const compCustomId = comp.customId || comp.data?.custom_id;
              if (compCustomId === customId) {
                const label = comp.label || comp.data?.label || '';
                const match = label.match(/\((\d+)\)/);
                if (match) {
                  const count = parseInt(match[1], 10) + 1;
                  btn.setLabel(label.replace(/\(\d+\)/, `(${count})`));
                }
              }
              newRow.addComponents(btn);
            }
            return newRow;
          });

          await interaction.message.edit({ components: updatedRows });
        }
      } catch {
        // Continue and acknowledge even if component update fails
      }

      const labelEmoji = action === 'heart' ? '❤️ Yêu thích' : '😂 Haha';
      await interaction.reply({
        content: `${labelEmoji} Đã thả cảm xúc thành công!`,
        ephemeral: true
      });
      return;
    }
  }
}

/**
 * Direct Message Confession Listener.
 * Intercepts DMs, finds mutual guilds, and presents interactive confirmation buttons.
 */
export async function handleDirectMessageConfession(message: Message): Promise<void> {
  if (message.author.bot) return;

  const content = message.content?.trim();
  if (!content || content.length < 10 || content.length > 1000) {
    await message.reply('❌ Nội dung confession phải từ 10 đến 1000 ký tự.');
    return;
  }

  const rateLimit = ConfessionService.checkRateLimit(message.author.id);
  if (!rateLimit.allowed) {
    await message.reply(`⏳ Bạn đang trong thời gian chờ. Vui lòng thử lại sau ${rateLimit.retryAfterSeconds} giây.`);
    return;
  }
  (ConfessionService as any).userCooldowns?.delete(message.author.id);

  const mutualGuilds: any[] = [];
  if (message.client.guilds?.cache) {
    for (const guild of message.client.guilds.cache.values()) {
      try {
        let isMember = false;
        if (guild.members?.cache?.has(message.author.id)) {
          isMember = true;
        } else if (typeof guild.members?.fetch === 'function') {
          const fetched = await guild.members.fetch(message.author.id).catch(() => null);
          if (fetched) isMember = true;
        }
        if (isMember) {
          mutualGuilds.push(guild);
        }
      } catch {
        // Skip guild on error
      }
    }
  }

  if (mutualGuilds.length === 0) {
    await message.reply('❌ Bạn không có server chung nào với bot hoặc bot không tìm thấy server phù hợp.');
    return;
  }

  pendingDmConfessions.set(message.author.id, {
    content,
    expiresAt: Date.now() + 10 * 60 * 1000
  });

  const embed = new EmbedBuilder()
    .setTitle('📬 Xác nhận gửi Confession')
    .setDescription(`Bạn đang chuẩn bị gửi confession ẩn danh sau:\n\n>>> ${content}\n\nVui lòng chọn server bạn muốn đăng bài:`)
    .setColor(0x5865f2)
    .setFooter({ text: 'Confession sẽ được đăng hoàn toàn ẩn danh (Zero-Trace).' });

  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  let currentRow = new ActionRowBuilder<ButtonBuilder>();

  for (const guild of mutualGuilds.slice(0, 24)) {
    if (currentRow.components.length === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder<ButtonBuilder>();
    }
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`confess:dm_send:${guild.id}`)
        .setLabel(`🚀 Gửi vào ${guild.name}`.slice(0, 80))
        .setStyle(ButtonStyle.Primary)
    );
  }

  if (currentRow.components.length === 5) {
    rows.push(currentRow);
    currentRow = new ActionRowBuilder<ButtonBuilder>();
  }
  currentRow.addComponents(
    new ButtonBuilder()
      .setCustomId('confess:dm_cancel')
      .setLabel('❌ Hủy')
      .setStyle(ButtonStyle.Danger)
  );
  rows.push(currentRow);

  await message.reply({ embeds: [embed], components: rows });
}
