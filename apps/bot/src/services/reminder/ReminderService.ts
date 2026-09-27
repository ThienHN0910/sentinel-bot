import { Client, TextChannel } from 'discord.js';
import { ReminderModel } from '../../models/Reminder';

export interface CreateReminderParams {
  userId: string;
  guildId: string;
  channelId: string;
  message: string;
  remindAt: Date;
}

export class ReminderService {
  private static pollTimer: NodeJS.Timeout | null = null;

  public static async createReminder(
    paramsOrUserId: CreateReminderParams | string,
    guildId?: string,
    channelId?: string,
    message?: string,
    remindAt?: Date
  ) {
    if (typeof paramsOrUserId === 'object') {
      return await ReminderModel.create({
        ...paramsOrUserId,
        status: 'pending'
      });
    }

    return await ReminderModel.create({
      userId: paramsOrUserId,
      guildId: guildId!,
      channelId: channelId!,
      message: message!,
      remindAt: remindAt!,
      status: 'pending'
    });
  }

  public static async pollReminders(client: Client) {
    const now = new Date();
    const dueReminders = await ReminderModel.find({
      remindAt: { $lte: now },
      status: 'pending'
    }).limit(20);

    for (const rem of dueReminders) {
      rem.status = 'completed';
      await rem.save();

      try {
        const channel = (await client.channels.fetch(rem.channelId)) as TextChannel;
        if (channel && typeof channel.send === 'function') {
          await channel.send(`⏰ <@${rem.userId}> **NHẮC NHỞ:** ${rem.message}`);
        }
      } catch (e) {
        console.warn('Failed to send reminder to channel:', rem.channelId, e);
      }
    }

    return dueReminders;
  }

  public static startPolling(client: Client, intervalMs = 30000) {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }

    this.pollTimer = setInterval(async () => {
      await this.pollReminders(client);
    }, intervalMs);

    return this.pollTimer;
  }

  public static stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}
