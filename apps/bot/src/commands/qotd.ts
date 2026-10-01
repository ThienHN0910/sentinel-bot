import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder
} from 'discord.js';
import { DailyQuestionModel } from '../models/DailyQuestion.js';
import { GuildConfigModel } from '../models/GuildConfig.js';
import { DailyQuestionService } from '../services/qotd/DailyQuestionService.js';

export const qotdSlashCommand = new SlashCommandBuilder()
  .setName('qotd')
  .setDescription('Hệ thống câu hỏi hằng ngày (QOTD) & Câu đố tri thức')
  .addSubcommand((sub) =>
    sub
      .setName('today')
      .setDescription('Xem câu hỏi và thống kê bình chọn hôm nay')
  )
  .addSubcommand((sub) =>
    sub
      .setName('post')
      .setDescription('Đăng thủ công câu hỏi hôm nay (Yêu cầu Quản lý Server)')
  )
  .addSubcommand((sub) =>
    sub
      .setName('config')
      .setDescription('Cấu hình kênh đăng câu hỏi hằng ngày (Yêu cầu Quản lý Server)')
      .addChannelOption((opt) =>
        opt
          .setName('channel')
          .setDescription('Kênh văn bản nhận câu hỏi QOTD')
          .setRequired(true)
      )
  );

/**
 * Handles /qotd slash command interactions.
 */
export async function handleQotdCommand(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const { guildId } = interaction;
  if (!guildId) {
    await interaction.reply({
      content: 'Lệnh này chỉ dùng trong server Discord.',
      ephemeral: true
    });
    return;
  }

  const subcommand = interaction.options.getSubcommand();

  // ── /qotd config ──────────────────────────────────────────────────────────
  if (subcommand === 'config') {
    const hasPermission =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ??
      Boolean(
        (interaction.member as any)?.permissions?.has?.(
          PermissionFlagsBits.ManageGuild
        )
      );

    if (!hasPermission) {
      await interaction.reply({
        content: '⚠️ Bạn không có quyền Quản lý Server để cấu hình kênh QOTD.',
        ephemeral: true
      });
      return;
    }

    const channel = interaction.options.getChannel('channel', true);

    await GuildConfigModel.findOneAndUpdate(
      { guildId },
      { $set: { qotdChannelId: channel.id, updatedAt: new Date() } },
      { upsert: true }
    );

    await interaction.reply({
      content: `✅ Đã cấu hình thành công kênh đăng câu hỏi hằng ngày: <#${channel.id}>`,
      ephemeral: true
    });
    return;
  }

  // ── /qotd post ────────────────────────────────────────────────────────────
  if (subcommand === 'post') {
    const hasPermission =
      interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) ??
      Boolean(
        (interaction.member as any)?.permissions?.has?.(
          PermissionFlagsBits.ManageGuild
        )
      );

    if (!hasPermission) {
      await interaction.reply({
        content: '⚠️ Bạn không có quyền Quản lý Server để kích hoạt đăng câu hỏi.',
        ephemeral: true
      });
      return;
    }

    try {
      const question = await DailyQuestionService.postDailyQuestion({
        guildId,
        client: interaction.client
      });

      await interaction.reply({
        content: `✅ Đã đăng câu hỏi hằng ngày thành công! (ID tin nhắn: ${question.messageId})`,
        ephemeral: true
      });
    } catch (error: any) {
      await interaction.reply({
        content: `⚠️ Không thể đăng câu hỏi: ${error?.message || error}`,
        ephemeral: true
      });
    }
    return;
  }

  // ── /qotd today ───────────────────────────────────────────────────────────
  if (subcommand === 'today') {
    const date = DailyQuestionService.getTodayDateString();
    const question = await DailyQuestionModel.findOne({ guildId, date });

    if (!question) {
      await interaction.reply({
        content:
          'Chưa có câu hỏi nào hôm nay trong server. Hãy nhờ quản trị viên dùng `/qotd post` hoặc chờ bot tự động đăng lúc 10:00.',
        ephemeral: true
      });
      return;
    }

    const embed = DailyQuestionService.createQuestionEmbed(question);
    const row = DailyQuestionService.createQuestionButtons(question);

    await interaction.reply({
      embeds: [embed],
      components: [row]
    });
    return;
  }
}

/**
 * Handles voting button clicks on QOTD messages.
 */
export async function handleQotdButton(
  interaction: ButtonInteraction
): Promise<void> {
  const { customId, guildId, user } = interaction;
  if (!guildId) return;

  const parts = customId.split(':');
  // customId format: qotd:vote:<date>:<optionKey>
  if (parts.length < 4 || parts[0] !== 'qotd' || parts[1] !== 'vote') {
    return;
  }

  const date = parts[2];
  const optionKey = parts[3];

  const result = await DailyQuestionService.recordVote({
    guildId,
    date,
    userId: user.id,
    username: user.username,
    optionKey
  });

  if (!result.success) {
    await interaction.reply({
      content: `⚠️ ${result.error || 'Không thể ghi nhận bình chọn.'}`,
      ephemeral: true
    });
    return;
  }

  let replyText = `✅ Đã ghi nhận bình chọn của bạn cho lựa chọn [${optionKey}]!`;

  if (result.question.type === 'trivia') {
    if (result.isCorrect) {
      if (result.rewardEarned) {
        replyText =
          '🎉 Chính xác! Bạn đã nhận được **+50 DNE Coins** và **+20 XP**!';
      } else {
        replyText = '🎉 Chính xác! (Bạn đã nhận phần thưởng trước đó)';
      }
    } else {
      replyText = '❌ Rất tiếc, câu trả lời của bạn chưa chính xác!';
    }
  }

  await interaction.reply({
    content: replyText,
    ephemeral: true
  });

  if (interaction.message && typeof interaction.message.edit === 'function') {
    try {
      const updatedEmbed = DailyQuestionService.createQuestionEmbed(
        result.question
      );
      await interaction.message.edit({ embeds: [updatedEmbed] });
    } catch {
      // Ignore background edit errors if message was deleted or missing permissions
    }
  }
}
