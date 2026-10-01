import type { IBadge } from '@sentinel/shared';
import { UserStatModel } from '../../models/UserStat.js';

export const BADGE_CATALOG: IBadge[] = [
  {
    id: 'chatter_100',
    name: 'Người Hướng Ngoại',
    description: 'Gửi 100 tin nhắn trong server',
    emoji: '🥉',
    category: 'chat'
  },
  {
    id: 'chatter_1000',
    name: 'Bàn Phím Vàng',
    description: 'Gửi 1.000 tin nhắn trong server',
    emoji: '🥈',
    category: 'chat'
  },
  {
    id: 'chatter_5000',
    name: 'Chiến Thần Tám Chuyện',
    description: 'Gửi 5.000 tin nhắn trong server',
    emoji: '🥇',
    category: 'chat'
  },
  {
    id: 'voice_10h',
    name: 'Treo Tai Nghe',
    description: 'Đạt 10 giờ đàm thoại voice',
    emoji: '🎧',
    category: 'voice'
  },
  {
    id: 'voice_50h',
    name: 'Đỉnh Cao Đàm Đạo',
    description: 'Đạt 50 giờ đàm thoại voice',
    emoji: '🎙️',
    category: 'voice'
  },
  {
    id: 'voice_night',
    name: 'Cú Đêm Voice',
    description: 'Tham gia voice qua khung giờ khuya',
    emoji: '🦉',
    category: 'voice'
  },
  {
    id: 'streak_7',
    name: 'Giữ Lửa',
    description: 'Đạt chuỗi điểm danh 7 ngày /daily liên tiếp',
    emoji: '🔥',
    category: 'economy'
  },
  {
    id: 'coins_10k',
    name: 'Đại Gia Server',
    description: 'Sở hữu từ 10.000 DNE Coins',
    emoji: '💰',
    category: 'economy'
  },
  {
    id: 'rep_20',
    name: 'Idol Giới Trẻ',
    description: 'Đạt từ 20 điểm uy tín /rep',
    emoji: '⭐',
    category: 'social'
  },
  {
    id: 'gacha_legendary',
    name: 'Bàn Tay Vàng',
    description: 'Trúng vật phẩm Legendary trong vòng quay gacha',
    emoji: '🍀',
    category: 'luck'
  }
];

export interface LockedBadgeProgress extends IBadge {
  current: number;
  target: number;
  unit: string;
  progressText: string;
}

export interface UserBadgesSummary {
  unlocked: IBadge[];
  locked: LockedBadgeProgress[];
  equippedBadge: IBadge | null;
  totalCount: number;
  unlockedCount: number;
}

export class BadgeService {
  /**
   * Returns all available badges in the system catalog.
   */
  static getAllBadges(): IBadge[] {
    return BADGE_CATALOG;
  }

  /**
   * Retrieves a specific badge definition by its ID.
   */
  static getBadge(id: string): IBadge | undefined {
    return BADGE_CATALOG.find((badge) => badge.id === id);
  }

  /**
   * Evaluates milestone metrics from UserStat and automatically unlocks qualified badges.
   * Returns a list of newly unlocked badge IDs.
   */
  static async evaluateBadges(guildId: string, userId: string): Promise<string[]> {
    const userStat = await UserStatModel.findOne({ guildId, userId });
    if (!userStat) {
      return [];
    }

    const currentUnlocked = new Set<string>(userStat.unlockedBadges || []);
    const newlyQualified: string[] = [];

    const messages = userStat.totalMessages || 0;
    const voiceMinutes = Math.floor((userStat.totalVoiceSeconds || 0) / 60);
    const dailyStreak = userStat.dailyStreak || 0;
    const coins = userStat.dneCoins || 0;
    const rep = userStat.repCount || 0;

    // Chat milestones
    if (messages >= 100 && !currentUnlocked.has('chatter_100')) {
      newlyQualified.push('chatter_100');
    }
    if (messages >= 1000 && !currentUnlocked.has('chatter_1000')) {
      newlyQualified.push('chatter_1000');
    }
    if (messages >= 5000 && !currentUnlocked.has('chatter_5000')) {
      newlyQualified.push('chatter_5000');
    }

    // Voice milestones
    if (voiceMinutes >= 600 && !currentUnlocked.has('voice_10h')) {
      newlyQualified.push('voice_10h');
    }
    if (voiceMinutes >= 3000 && !currentUnlocked.has('voice_50h')) {
      newlyQualified.push('voice_50h');
    }

    // Economy & Social milestones
    if (dailyStreak >= 7 && !currentUnlocked.has('streak_7')) {
      newlyQualified.push('streak_7');
    }
    if (coins >= 10000 && !currentUnlocked.has('coins_10k')) {
      newlyQualified.push('coins_10k');
    }
    if (rep >= 20 && !currentUnlocked.has('rep_20')) {
      newlyQualified.push('rep_20');
    }

    if (newlyQualified.length > 0) {
      await UserStatModel.findOneAndUpdate(
        { guildId, userId },
        { $addToSet: { unlockedBadges: { $each: newlyQualified } } }
      );
    }

    return newlyQualified;
  }

  /**
   * Atomically grants a badge to a user (used for special/event triggers e.g. gacha legendary or night voice).
   */
  static async unlockBadge(guildId: string, userId: string, badgeId: string): Promise<boolean> {
    const badge = this.getBadge(badgeId);
    if (!badge) {
      return false;
    }

    const updated = await UserStatModel.findOneAndUpdate(
      { guildId, userId },
      { $addToSet: { unlockedBadges: badgeId } },
      { new: true }
    );

    return !!updated;
  }

  /**
   * Equips a chosen unlocked badge to the user's active identity.
   */
  static async equipBadge(
    guildId: string,
    userId: string,
    badgeId: string
  ): Promise<{ success: boolean; badge: IBadge }> {
    const userStat = await UserStatModel.findOne({ guildId, userId });
    const hasUnlocked = userStat?.unlockedBadges?.includes(badgeId);

    if (!hasUnlocked) {
      throw new Error('Bạn chưa mở khóa huy hiệu này!');
    }

    const badge = this.getBadge(badgeId);
    if (!badge) {
      throw new Error('Huy hiệu không tồn tại!');
    }

    await UserStatModel.findOneAndUpdate(
      { guildId, userId },
      { $set: { equippedBadge: badgeId } }
    );

    return { success: true, badge };
  }

  /**
   * Unequips the currently equipped badge.
   */
  static async unequipBadge(guildId: string, userId: string): Promise<boolean> {
    await UserStatModel.findOneAndUpdate(
      { guildId, userId },
      { $set: { equippedBadge: null } }
    );
    return true;
  }

  /**
   * Returns a comprehensive overview of user badges (unlocked, locked with progress, and equipped badge).
   */
  static async getUserBadges(guildId: string, userId: string): Promise<UserBadgesSummary> {
    const userStat = await UserStatModel.findOne({ guildId, userId });
    const unlockedIds = new Set<string>(userStat?.unlockedBadges || []);
    const equippedId = userStat?.equippedBadge || null;

    const messages = userStat?.totalMessages || 0;
    const voiceMinutes = Math.floor((userStat?.totalVoiceSeconds || 0) / 60);
    const dailyStreak = userStat?.dailyStreak || 0;
    const coins = userStat?.dneCoins || 0;
    const rep = userStat?.repCount || 0;

    const unlocked: IBadge[] = [];
    const locked: LockedBadgeProgress[] = [];

    for (const badge of BADGE_CATALOG) {
      if (unlockedIds.has(badge.id)) {
        unlocked.push(badge);
      } else {
        let current = 0;
        let target = 1;
        let unit = '';
        let progressText = '';

        switch (badge.id) {
          case 'chatter_100':
            current = messages;
            target = 100;
            unit = 'tin nhắn';
            progressText = `${Math.min(current, target)}/${target} tin nhắn`;
            break;
          case 'chatter_1000':
            current = messages;
            target = 1000;
            unit = 'tin nhắn';
            progressText = `${Math.min(current, target)}/${target} tin nhắn`;
            break;
          case 'chatter_5000':
            current = messages;
            target = 5000;
            unit = 'tin nhắn';
            progressText = `${Math.min(current, target)}/${target} tin nhắn`;
            break;
          case 'voice_10h':
            current = voiceMinutes;
            target = 600;
            unit = 'phút voice';
            progressText = `${Math.min(current, target)}/${target} phút (${(current / 60).toFixed(1)}/10h)`;
            break;
          case 'voice_50h':
            current = voiceMinutes;
            target = 3000;
            unit = 'phút voice';
            progressText = `${Math.min(current, target)}/${target} phút (${(current / 60).toFixed(1)}/50h)`;
            break;
          case 'voice_night':
            current = 0;
            target = 1;
            unit = 'khung giờ khuya';
            progressText = 'Tham gia voice 23:00 - 05:00';
            break;
          case 'streak_7':
            current = dailyStreak;
            target = 7;
            unit = 'ngày liên tiếp';
            progressText = `${Math.min(current, target)}/${target} ngày streak`;
            break;
          case 'coins_10k':
            current = coins;
            target = 10000;
            unit = 'DNE Coins';
            progressText = `${Math.min(current, target)}/${target} coins`;
            break;
          case 'rep_20':
            current = rep;
            target = 20;
            unit = 'điểm rep';
            progressText = `${Math.min(current, target)}/${target} rep`;
            break;
          case 'gacha_legendary':
            current = 0;
            target = 1;
            unit = 'lần';
            progressText = 'Quay trúng phẩm chất Legendary';
            break;
          default:
            progressText = 'Chưa hoàn thành';
            break;
        }

        locked.push({
          ...badge,
          current,
          target,
          unit,
          progressText
        });
      }
    }

    const equippedBadge = equippedId ? this.getBadge(equippedId) || null : null;

    return {
      unlocked,
      locked,
      equippedBadge,
      totalCount: BADGE_CATALOG.length,
      unlockedCount: unlocked.length
    };
  }
}
