import type { ChatInputCommandInteraction } from 'discord.js';
import { ReminderService, parseReminderDelay } from '../services/reminder/ReminderService';
import { withQueryTimeout } from './queryTimeout';

const QUERY_TIMEOUT_MS = 8_000;
const preview = (value: string) => value.replace(/\s+/g, ' ').slice(0, 65);

export async function handleRemindCommand(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.guildId) {
    await interaction.reply({ content: 'Lệnh này chỉ dùng trong server Discord.', ephemeral: true });
    return;
  }
  await interaction.deferReply({ ephemeral: true });
  const subcommand = interaction.options.getSubcommand();

  if (subcommand === 'set') {
    const duration = interaction.options.getString('in', true);
    const text = interaction.options.getString('text', true).trim();
    let delay: number;
    try {
      delay = parseReminderDelay(duration);
    } catch {
      await interaction.editReply('Lỗi thời gian: dùng 1m–7d, ví dụ 10m, 2h hoặc 1d.');
      return;
    }
    if (!text || text.length > 200) {
      await interaction.editReply('Nội dung lời nhắc cần từ 1 đến 200 ký tự.');
      return;
    }
    try {
      const reminder = await withQueryTimeout(ReminderService.createReminder({
        userId: interaction.user.id, guildId: interaction.guildId, message: text,
        remindAt: new Date(Date.now() + delay)
      }), QUERY_TIMEOUT_MS);
      await interaction.editReply(`Đã đặt lời nhắc \`${reminder.publicId}\` lúc <t:${Math.floor(reminder.remindAt.getTime() / 1000)}:F>. Bot sẽ gửi DM; hãy mở DM từ thành viên server để nhận được lời nhắc.`);
    } catch (error) {
      const message = error instanceof Error && error.message.includes('10 lời nhắc')
        ? error.message : 'Không thể tạo lời nhắc lúc này. Vui lòng thử lại sau.';
      await interaction.editReply(message);
    }
    return;
  }

  if (subcommand === 'list') {
    try {
      const { pending, failed } = await withQueryTimeout(ReminderService.listReminders(interaction.user.id), QUERY_TIMEOUT_MS);
      const lines = [
        '**Lời nhắc đang chờ:**',
        ...((pending.length ? pending : []).map((reminder) =>
          `• \`${reminder.publicId}\` · <t:${Math.floor(reminder.remindAt.getTime() / 1000)}:F> · ${preview(reminder.message)}`)),
        ...(!pending.length ? ['Chưa có lời nhắc đang chờ.'] : []),
        '**DM gửi thất bại gần đây:**',
        ...failed.map((reminder) => `• \`${reminder.publicId}\` · ${preview(reminder.message)}`),
        ...(!failed.length ? ['Không có.'] : [])
      ];
      await interaction.editReply(lines.join('\n'));
    } catch {
      await interaction.editReply('Không thể tải lời nhắc lúc này. Vui lòng thử lại sau.');
    }
    return;
  }

  if (subcommand === 'cancel') {
    const id = interaction.options.getString('id', true);
    try {
      const cancelled = await withQueryTimeout(ReminderService.cancelReminder(interaction.user.id, id), QUERY_TIMEOUT_MS);
      await interaction.editReply(cancelled ? 'Đã hủy lời nhắc.' : 'Không tìm thấy lời nhắc đang chờ của bạn.');
    } catch {
      await interaction.editReply('Không thể hủy lời nhắc lúc này. Vui lòng thử lại sau.');
    }
  }
}
