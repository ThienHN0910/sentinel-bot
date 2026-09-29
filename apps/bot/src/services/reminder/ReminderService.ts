import { Client } from 'discord.js';
import { nanoid } from 'nanoid';
import { ReminderModel, type ReminderDocument } from '../../models/Reminder';

const DAY_MS = 86_400_000;
const RETENTION_MS = 7 * DAY_MS;
const STALE_SEND_MS = 10 * 60_000;
const MAX_BATCH = 20;

export interface CreateReminderParams {
  userId: string;
  guildId: string;
  message: string;
  remindAt: Date;
}

export function parseReminderDelay(input: string): number {
  const match = /^(\d+)([mhd])$/.exec(input);
  if (!match) throw new Error('Thời gian phải có dạng 10m, 2h hoặc 1d.');
  const amount = Number(match[1]);
  const unit = match[2] === 'm' ? 60_000 : match[2] === 'h' ? 3_600_000 : DAY_MS;
  const delay = amount * unit;
  if (!Number.isSafeInteger(amount) || !Number.isSafeInteger(delay) || delay < 60_000 || delay > RETENTION_MS) {
    throw new Error('Chọn thời gian từ 1 phút đến 7 ngày.');
  }
  return delay;
}

export class ReminderService {
  private static pollTimer: NodeJS.Timeout | null = null;
  private static polling = false;

  public static async createReminder(params: CreateReminderParams): Promise<ReminderDocument> {
    if (!params.userId || !params.guildId || !params.message.trim() || params.message.length > 200 ||
      !Number.isFinite(params.remindAt.getTime())) throw new Error('Lời nhắc không hợp lệ.');
    const delay = params.remindAt.getTime() - Date.now();
    if (delay < 59_000 || delay > RETENTION_MS) throw new Error('Chọn thời gian từ 1 phút đến 7 ngày.');
    for (let slot = 0; slot < 10; slot++) {
      try {
        return await ReminderModel.create({ ...params, publicId: nanoid(12), slot, status: 'pending', attempts: 0 });
      } catch (error) {
        if ((error as { code?: number }).code !== 11000) throw error;
      }
    }
    throw new Error('Bạn đã có 10 lời nhắc đang chờ.');
  }

  public static async listReminders(userId: string): Promise<{ pending: ReminderDocument[]; failed: ReminderDocument[] }> {
    const [pending, failed] = await Promise.all([
      ReminderModel.find({ userId, status: 'pending' }).sort({ remindAt: 1 }).limit(10),
      ReminderModel.find({ userId, status: 'failed' }).sort({ remindAt: -1 }).limit(5)
    ]);
    return { pending, failed };
  }

  public static async cancelReminder(userId: string, publicId: string): Promise<boolean> {
    if (!/^[A-Za-z0-9_-]{12}$/.test(publicId)) return false;
    const changed = await ReminderModel.findOneAndUpdate(
      { userId, publicId, status: 'pending' },
      { $set: { status: 'cancelled', deleteAt: new Date(Date.now() + RETENTION_MS) } },
      { new: true }
    );
    return !!changed;
  }

  public static async pollReminders(client: Client): Promise<number> {
    if (this.polling) return 0;
    this.polling = true;
    let processed = 0;
    try {
      const now = new Date();
      await ReminderModel.updateMany(
        // Discord DM sends have no idempotency key. A stale in-flight send may have succeeded,
        // so never reclaim it; surface it as failed for the user to inspect instead.
        { status: 'sending', claimedAt: { $lt: new Date(now.getTime() - STALE_SEND_MS) } },
        { $set: { status: 'failed', deleteAt: new Date(now.getTime() + RETENTION_MS) } }
      );
      for (let index = 0; index < MAX_BATCH; index++) {
        const claimedAt = new Date();
        const reminder = await ReminderModel.findOneAndUpdate(
          { status: 'pending', remindAt: { $lte: claimedAt } },
          { $set: { status: 'sending', claimedAt }, $inc: { attempts: 1 } },
          { sort: { remindAt: 1 }, new: true }
        );
        if (!reminder) break;
        try {
          const user = await client.users.fetch(reminder.userId);
          await user.send(`⏰ **NHẮC NHỞ:** ${reminder.message}`);
          await ReminderModel.updateOne(
            { _id: reminder._id, status: 'sending', claimedAt: reminder.claimedAt },
            { $set: { status: 'completed', deleteAt: new Date(Date.now() + RETENTION_MS) } }
          );
        } catch {
          await ReminderModel.updateOne(
            { _id: reminder._id, status: 'sending', claimedAt: reminder.claimedAt },
            { $set: { status: 'failed', deleteAt: new Date(Date.now() + RETENTION_MS) } }
          );
        }
        processed++;
      }
      return processed;
    } finally {
      this.polling = false;
    }
  }

  public static startPolling(client: Client, intervalMs = 30_000): NodeJS.Timeout {
    this.stopPolling();
    this.pollTimer = setInterval(() => {
      void this.pollReminders(client).catch((error) => console.warn('[Reminder] Poll failed:', error));
    }, intervalMs);
    return this.pollTimer;
  }

  public static stopPolling(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = null;
  }
}
