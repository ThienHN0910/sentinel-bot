import { GachaRarity, GachaResult } from '@sentinel/shared';
import { UserStatModel } from '../../models/UserStat';

export class GachaService {
  public static readonly GACHA_COST = 200;
  public static readonly PITY_THRESHOLD = 50;

  /**
   * Free spin is available if the user has never spun or >= 24 hours have passed since lastGachaAt.
   */
  public static isFreeRollAvailable(lastGachaAt?: Date, now: Date = new Date()): boolean {
    if (!lastGachaAt) return true;
    const elapsedMs = now.getTime() - lastGachaAt.getTime();
    return elapsedMs >= 24 * 3600 * 1000;
  }

  /**
   * Deterministically or randomly selects drop from weighted probability table.
   * If pity >= PITY_THRESHOLD (50), guarantees EPIC (80%) or LEGENDARY (20%).
   */
  public static selectDrop(
    pity: number,
    randomFn: () => number = Math.random
  ): {
    rarity: GachaRarity;
    rewardCoins: number;
    rewardXp: number;
    isPityGuaranteed: boolean;
  } {
    if (pity >= this.PITY_THRESHOLD) {
      const pityRoll = randomFn();
      if (pityRoll < 0.80) {
        return {
          rarity: 'EPIC',
          rewardCoins: 500,
          rewardXp: 100,
          isPityGuaranteed: true
        };
      }
      return {
        rarity: 'LEGENDARY',
        rewardCoins: 1000,
        rewardXp: 250,
        isPityGuaranteed: true
      };
    }

    const roll = randomFn();

    // Common (50%): 20 - 50 coins, 0 XP
    if (roll < 0.50) {
      const rewardCoins = Math.floor(randomFn() * (50 - 20 + 1)) + 20;
      return {
        rarity: 'COMMON',
        rewardCoins,
        rewardXp: 0,
        isPityGuaranteed: false
      };
    }

    // Uncommon (25%): 80 - 150 coins, 0 XP
    if (roll < 0.75) {
      const rewardCoins = Math.floor(randomFn() * (150 - 80 + 1)) + 80;
      return {
        rarity: 'UNCOMMON',
        rewardCoins,
        rewardXp: 0,
        isPityGuaranteed: false
      };
    }

    // Rare (15%): 200 - 300 coins, 50 XP
    if (roll < 0.90) {
      const rewardCoins = Math.floor(randomFn() * (300 - 200 + 1)) + 200;
      return {
        rarity: 'RARE',
        rewardCoins,
        rewardXp: 50,
        isPityGuaranteed: false
      };
    }

    // Epic (8%): 500 coins, 100 XP
    if (roll < 0.98) {
      return {
        rarity: 'EPIC',
        rewardCoins: 500,
        rewardXp: 100,
        isPityGuaranteed: false
      };
    }

    // Legendary (2%): 1,000 coins, 250 XP
    return {
      rarity: 'LEGENDARY',
      rewardCoins: 1000,
      rewardXp: 250,
      isPityGuaranteed: false
    };
  }

  /**
   * Executes a gacha spin for a user.
   * Free if >= 24h since last free spin; otherwise costs GACHA_COST (200 DNE Coins).
   */
  public static async spin(params: {
    guildId: string;
    userId: string;
    username?: string;
    now?: Date;
    randomFn?: () => number;
  }): Promise<GachaResult> {
    const { guildId, userId, username, now = new Date(), randomFn } = params;

    const user = await UserStatModel.findOne({ guildId, userId });
    const currentBalance = user?.dneCoins ?? 0;
    const currentPity = user?.gachaPity ?? 0;
    const lastGachaAt = user?.lastGachaAt;

    const isFree = this.isFreeRollAvailable(lastGachaAt, now);
    const cost = isFree ? 0 : this.GACHA_COST;

    if (!isFree && currentBalance < cost) {
      throw new Error(
        `Bạn không đủ DNE Coins! Cần 200 xu cho lượt quay này. Số dư hiện tại: ${currentBalance} xu`
      );
    }

    const drop = this.selectDrop(currentPity, randomFn);
    const isHighTier = drop.rarity === 'EPIC' || drop.rarity === 'LEGENDARY';
    const newPity = isHighTier ? 0 : currentPity + 1;
    const netCoins = drop.rewardCoins - cost;
    const calculatedBalance = currentBalance + netCoins;

    const updateOps: any = {
      $inc: {
        dneCoins: netCoins,
        ...(drop.rewardXp > 0 ? { exp: drop.rewardXp } : {})
      },
      $set: {
        gachaPity: newPity,
        updatedAt: now
      },
      $setOnInsert: {
        username: username || user?.username || userId
      }
    };

    if (isFree) {
      updateOps.$set.lastGachaAt = now;
    }

    const updated = await UserStatModel.findOneAndUpdate(
      { guildId, userId },
      updateOps,
      { upsert: true, new: true }
    );

    const newBalance = updated?.dneCoins ?? calculatedBalance;

    return {
      rarity: drop.rarity,
      rewardCoins: drop.rewardCoins,
      rewardXp: drop.rewardXp,
      isFree,
      cost,
      newBalance,
      pity: newPity,
      isPityGuaranteed: drop.isPityGuaranteed
    };
  }
}
