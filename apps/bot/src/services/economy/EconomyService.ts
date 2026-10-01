import { UserStatModel } from '../../models/UserStat';

export function calculateDailyStreak(currentStreak: number, lastDailyAt?: Date, now: Date = new Date()) {
  if (!lastDailyAt) {
    return { newStreak: 1, rewardCoins: 100 };
  }

  const hoursDiff = (now.getTime() - lastDailyAt.getTime()) / (1000 * 3600);
  if (hoursDiff < 20) {
    throw new Error('Bạn đã nhận điểm danh hôm nay rồi! Hãy quay lại sau.');
  }

  if (hoursDiff <= 48) {
    const newStreak = Math.min(currentStreak + 1, 7);
    const bonus = (newStreak - 1) * 10;
    return { newStreak, rewardCoins: 100 + bonus };
  }

  // Broken streak
  return { newStreak: 1, rewardCoins: 100 };
}

export function expForLevel(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function calculateLevel(exp: number): number {
  let level = 1;
  while (exp >= expForLevel(level + 1)) {
    level++;
  }
  return level;
}

export class LevelService {
  public static expForLevel(level: number): number {
    return expForLevel(level);
  }

  public static calculateLevel(exp: number): number {
    return calculateLevel(exp);
  }
}

export class EconomyService {
  public static async getDailyStatus(guildId: string, userId: string, now: Date = new Date()): Promise<{
    canClaim: boolean;
    hoursRemaining: number;
    minutesRemaining: number;
    currentStreak: number;
    dneCoins: number;
  }> {
    const stat = await UserStatModel.findOne({ guildId, userId });
    const dneCoins = stat?.dneCoins ?? 0;
    const rawStreak = stat?.dailyStreak ?? 0;

    if (!stat?.lastDailyAt) {
      return {
        canClaim: true,
        hoursRemaining: 0,
        minutesRemaining: 0,
        currentStreak: rawStreak,
        dneCoins
      };
    }

    const elapsedMs = now.getTime() - stat.lastDailyAt.getTime();
    const cooldownMs = 20 * 3600 * 1000;

    if (elapsedMs < cooldownMs) {
      const remainingMs = cooldownMs - elapsedMs;
      const totalMinutes = Math.max(0, Math.ceil(remainingMs / (60 * 1000)));
      return {
        canClaim: false,
        hoursRemaining: Math.floor(totalMinutes / 60),
        minutesRemaining: totalMinutes % 60,
        currentStreak: rawStreak,
        dneCoins
      };
    }

    const isBroken = elapsedMs > 48 * 3600 * 1000;
    return {
      canClaim: true,
      hoursRemaining: 0,
      minutesRemaining: 0,
      currentStreak: isBroken ? 0 : rawStreak,
      dneCoins
    };
  }

  public static async claimDaily(guildId: string, userId: string, username?: string, now: Date = new Date()) {
    const stat = await UserStatModel.findOne({ guildId, userId });
    const { newStreak, rewardCoins } = calculateDailyStreak(stat?.dailyStreak || 0, stat?.lastDailyAt, now);

    const totalCoins = (stat?.dneCoins || 0) + rewardCoins;
    const twentyHoursAgo = new Date(now.getTime() - 20 * 3600 * 1000);

    const filter = {
      guildId,
      userId,
      $or: [
        { lastDailyAt: { $exists: false } },
        { lastDailyAt: { $lte: twentyHoursAgo } }
      ]
    };

    const update = {
      $inc: { dneCoins: rewardCoins },
      $set: { dailyStreak: newStreak, lastDailyAt: now, updatedAt: now },
      $setOnInsert: { username: username || stat?.username || userId }
    };

    const updated = await UserStatModel.findOneAndUpdate(
      filter,
      update,
      { new: true }
    );

    if (!updated) {
      const existing = await UserStatModel.findOne({ guildId, userId });
      if (existing) {
        throw new Error('Bạn đã nhận điểm danh hôm nay rồi! Hãy quay lại sau.');
      }

      try {
        const created = await UserStatModel.findOneAndUpdate(
          { guildId, userId },
          update,
          { upsert: true, new: true }
        );
        const finalCoins = typeof created?.dneCoins === 'number' ? created.dneCoins : totalCoins;
        return { streak: newStreak, reward: rewardCoins, totalCoins: finalCoins };
      } catch (err: any) {
        throw new Error('Bạn đã nhận điểm danh hôm nay rồi! Hãy quay lại sau.');
      }
    }

    const finalCoins = typeof updated?.dneCoins === 'number' ? updated.dneCoins : totalCoins;
    return { streak: newStreak, reward: rewardCoins, totalCoins: finalCoins };
  }

  public static async transferCoins(guildId: string, fromId: string, toId: string, amount: number) {
    if (amount <= 0) throw new Error('Số xu chuyển phải lớn hơn 0');

    const sender = await UserStatModel.findOne({ guildId, userId: fromId });
    if (!sender || sender.dneCoins < amount) {
      throw new Error('Số dư của bạn không đủ để thực hiện giao dịch!');
    }

    await UserStatModel.findOneAndUpdate({ guildId, userId: fromId }, { $inc: { dneCoins: -amount } });
    await UserStatModel.findOneAndUpdate({ guildId, userId: toId }, { $inc: { dneCoins: amount } }, { upsert: true });

    return true;
  }

  public static async transfer(guildId: string, fromId: string, toId: string, amount: number) {
    return this.transferCoins(guildId, fromId, toId, amount);
  }
}
