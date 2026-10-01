import { RepResult } from '@sentinel/shared';
import { UserStatModel } from '../../models/UserStat';

export class RepService {
  /**
   * Check if now is in a different calendar day than lastReset in UTC+7 (Asia/Ho_Chi_Minh).
   */
  public static isNewDay(lastReset?: Date, now: Date = new Date()): boolean {
    if (!lastReset) return true;
    const offset = 7 * 3600 * 1000;
    const d1 = new Date(lastReset.getTime() + offset);
    const d2 = new Date(now.getTime() + offset);
    return (
      d1.getUTCFullYear() !== d2.getUTCFullYear() ||
      d1.getUTCMonth() !== d2.getUTCMonth() ||
      d1.getUTCDate() !== d2.getUTCDate()
    );
  }

  /**
   * Gives +1 reputation to the receiver, decreasing giver's daily quota (up to 3 per UTC+7 day).
   */
  public static async giveRep(params: {
    guildId: string;
    giverId: string;
    giverUsername?: string;
    receiverId: string;
    receiverUsername?: string;
    reason?: string;
    now?: Date;
  }): Promise<RepResult> {
    const {
      guildId,
      giverId,
      giverUsername,
      receiverId,
      receiverUsername,
      now = new Date()
    } = params;

    // Rule 1: Self-rep forbidden
    if (giverId === receiverId) {
      return {
        success: false,
        giverRemaining: 0,
        receiverRepCount: 0,
        error: 'Bạn không thể tự +rep cho chính mình!'
      };
    }

    // Check giver status and daily quota
    const giver = await UserStatModel.findOne({ guildId, userId: giverId });
    const needsReset = !giver?.lastRepResetAt || this.isNewDay(giver.lastRepResetAt, now);
    const currentRepGivenToday = needsReset ? 0 : (giver?.repGivenToday ?? 0);

    // Rule 2 & 4: Daily Quota check (max 3 reps per day)
    if (currentRepGivenToday >= 3) {
      return {
        success: false,
        giverRemaining: 0,
        receiverRepCount: 0,
        error: 'Bạn đã dùng hết 3 lượt +rep hôm nay! Hãy quay lại vào ngày mai.'
      };
    }

    let updatedGiver: any = null;

    // Atomic update for giver
    if (needsReset) {
      await UserStatModel.findOneAndUpdate(
        { guildId, userId: giverId },
        {
          $set: { repGivenToday: 1, lastRepResetAt: now, updatedAt: now },
          $setOnInsert: { username: giverUsername || giver?.username || giverId }
        },
        { upsert: true }
      );
    } else {
      updatedGiver = await UserStatModel.findOneAndUpdate(
        { guildId, userId: giverId, repGivenToday: { $lt: 3 } },
        {
          $inc: { repGivenToday: 1 },
          $set: { updatedAt: now },
          $setOnInsert: { username: giverUsername || giver?.username || giverId }
        },
        { new: true }
      );

      if (!updatedGiver) {
        return {
          success: false,
          giverRemaining: 0,
          receiverRepCount: 0,
          error: 'Bạn đã dùng hết 3 lượt +rep hôm nay! Hãy quay lại vào ngày mai.'
        };
      }
    }

    // Atomic update for receiver (increment repCount)
    const updatedReceiver = await UserStatModel.findOneAndUpdate(
      { guildId, userId: receiverId },
      {
        $inc: { repCount: 1 },
        $set: { updatedAt: now },
        $setOnInsert: { username: receiverUsername || receiverId }
      },
      { upsert: true, new: true }
    );

    const giverRemaining = needsReset
      ? 2
      : Math.max(0, 3 - (updatedGiver?.repGivenToday ?? (currentRepGivenToday + 1)));
    const receiverRepCount = updatedReceiver?.repCount ?? 1;

    return {
      success: true,
      giverRemaining,
      receiverRepCount
    };
  }
}
