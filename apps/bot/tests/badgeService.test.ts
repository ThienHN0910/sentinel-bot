import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { IBadge } from '@sentinel/shared';
import { UserStatModel } from '../src/models/UserStat';
import { BadgeService, BADGE_CATALOG } from '../src/services/badge/BadgeService';
import { badgeSlashCommand, handleBadgeCommand } from '../src/commands/badge';

describe('BadgeService & Achievement System', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Badge Catalog Completeness', () => {
    it('defines exactly 10 badges with unique IDs and required metadata', () => {
      const allBadges = BadgeService.getAllBadges();
      expect(allBadges).toHaveLength(10);
      expect(BADGE_CATALOG).toHaveLength(10);

      const ids = allBadges.map((b) => b.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(10);

      const expectedIds = [
        'chatter_100',
        'chatter_1000',
        'chatter_5000',
        'voice_10h',
        'voice_50h',
        'voice_night',
        'streak_7',
        'coins_10k',
        'rep_20',
        'gacha_legendary'
      ];

      for (const expectedId of expectedIds) {
        expect(ids).toContain(expectedId);
      }

      for (const badge of allBadges) {
        expect(badge.id).toBeTruthy();
        expect(badge.name).toBeTruthy();
        expect(badge.description).toBeTruthy();
        expect(badge.emoji).toBeTruthy();
        expect(['chat', 'voice', 'economy', 'social', 'luck']).toContain(badge.category);
      }
    });

    it('retrieves badge by ID with getBadge() and returns undefined for unknown ID', () => {
      const badge = BadgeService.getBadge('chatter_100');
      expect(badge).toBeDefined();
      expect(badge?.name).toBe('Người Hướng Ngoại');
      expect(badge?.emoji).toBe('🥉');
      expect(badge?.category).toBe('chat');

      const unknown = BadgeService.getBadge('non_existent_badge');
      expect(unknown).toBeUndefined();
    });
  });

  describe('Auto-Unlock Logic (evaluateBadges)', () => {
    it('returns empty array when user stats document does not exist', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue(null);

      const newlyUnlocked = await BadgeService.evaluateBadges('guild-1', 'user-1');
      expect(newlyUnlocked).toEqual([]);
    });

    it('returns empty array if user does not meet any milestone thresholds', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        totalMessages: 50,
        totalVoiceSeconds: 1200, // 20 mins
        dailyStreak: 3,
        dneCoins: 500,
        repCount: 5,
        unlockedBadges: []
      } as any);

      const newlyUnlocked = await BadgeService.evaluateBadges('guild-1', 'user-1');
      expect(newlyUnlocked).toEqual([]);
    });

    it('evaluates and auto-unlocks chat milestones (100, 1000, 5000 messages)', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        totalMessages: 1500,
        totalVoiceSeconds: 0,
        dailyStreak: 0,
        dneCoins: 0,
        repCount: 0,
        unlockedBadges: []
      } as any);

      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

      const newlyUnlocked = await BadgeService.evaluateBadges('guild-1', 'user-1');
      expect(newlyUnlocked).toEqual(['chatter_100', 'chatter_1000']);
      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-1' },
        { $addToSet: { unlockedBadges: { $each: ['chatter_100', 'chatter_1000'] } } }
      );
    });

    it('evaluates voice milestones (600 mins = 10h, 3000 mins = 50h)', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        totalMessages: 0,
        totalVoiceSeconds: 3000 * 60, // 3000 mins = 50 hours
        dailyStreak: 0,
        dneCoins: 0,
        repCount: 0,
        unlockedBadges: []
      } as any);

      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

      const newlyUnlocked = await BadgeService.evaluateBadges('guild-1', 'user-1');
      expect(newlyUnlocked).toEqual(['voice_10h', 'voice_50h']);
      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-1' },
        { $addToSet: { unlockedBadges: { $each: ['voice_10h', 'voice_50h'] } } }
      );
    });

    it('evaluates dailyStreak (7 days), dneCoins (10,000), and repCount (20)', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        totalMessages: 0,
        totalVoiceSeconds: 0,
        dailyStreak: 7,
        dneCoins: 12500,
        repCount: 25,
        unlockedBadges: []
      } as any);

      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

      const newlyUnlocked = await BadgeService.evaluateBadges('guild-1', 'user-1');
      expect(newlyUnlocked).toEqual(['streak_7', 'coins_10k', 'rep_20']);
      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-1' },
        { $addToSet: { unlockedBadges: { $each: ['streak_7', 'coins_10k', 'rep_20'] } } }
      );
    });

    it('does not re-unlock already unlocked badges', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        totalMessages: 5500,
        totalVoiceSeconds: 0,
        dailyStreak: 0,
        dneCoins: 0,
        repCount: 0,
        unlockedBadges: ['chatter_100', 'chatter_1000'] // already has 100 & 1000
      } as any);

      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

      const newlyUnlocked = await BadgeService.evaluateBadges('guild-1', 'user-1');
      expect(newlyUnlocked).toEqual(['chatter_5000']);
      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-1' },
        { $addToSet: { unlockedBadges: { $each: ['chatter_5000'] } } }
      );
    });

    it('does not perform DB update when no new badges qualify', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        totalMessages: 150,
        totalVoiceSeconds: 0,
        dailyStreak: 0,
        dneCoins: 0,
        repCount: 0,
        unlockedBadges: ['chatter_100']
      } as any);

      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');

      const newlyUnlocked = await BadgeService.evaluateBadges('guild-1', 'user-1');
      expect(newlyUnlocked).toEqual([]);
      expect(updateSpy).not.toHaveBeenCalled();
    });
  });

  describe('Direct Unlock (unlockBadge) & $addToSet Atomicity', () => {
    it('atomically grants a badge via $addToSet when badge ID is valid', async () => {
      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        unlockedBadges: ['gacha_legendary']
      } as any);

      const result = await BadgeService.unlockBadge('guild-1', 'user-1', 'gacha_legendary');
      expect(result).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-1' },
        expect.objectContaining({
          $addToSet: { unlockedBadges: 'gacha_legendary' },
          $setOnInsert: expect.objectContaining({
            username: 'User',
            level: 1,
            exp: 0,
            dneCoins: 0
          })
        }),
        { upsert: true, new: true }
      );
    });

    it('rejects invalid badge ID and does not call DB', async () => {
      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');

      const result = await BadgeService.unlockBadge('guild-1', 'user-1', 'invalid_badge');
      expect(result).toBe(false);
      expect(updateSpy).not.toHaveBeenCalled();
    });

    it('returns true and upserts record even if user has no prior stats', async () => {
      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'brand-new-user',
        unlockedBadges: ['voice_night']
      } as any);

      const result = await BadgeService.unlockBadge('guild-1', 'brand-new-user', 'voice_night');
      expect(result).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'brand-new-user' },
        expect.objectContaining({
          $addToSet: { unlockedBadges: 'voice_night' }
        }),
        { upsert: true, new: true }
      );
    });
  });

  describe('Equip and Unequip Validation', () => {
    it('equips an unlocked badge successfully', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        unlockedBadges: ['chatter_100', 'streak_7'],
        equippedBadge: null
      } as any);

      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

      const res = await BadgeService.equipBadge('guild-1', 'user-1', 'streak_7');
      expect(res.success).toBe(true);
      expect(res.badge.id).toBe('streak_7');
      expect(res.badge.name).toBe('Giữ Lửa');
      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-1' },
        { $set: { equippedBadge: 'streak_7' } }
      );
    });

    it('throws error when equipping a badge the user has not unlocked', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        unlockedBadges: ['chatter_100'],
        equippedBadge: null
      } as any);

      await expect(
        BadgeService.equipBadge('guild-1', 'user-1', 'coins_10k')
      ).rejects.toThrow('Bạn chưa mở khóa huy hiệu này!');
    });

    it('throws error when equipping a non-existent badge ID', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        unlockedBadges: ['chatter_100'],
        equippedBadge: null
      } as any);

      await expect(
        BadgeService.equipBadge('guild-1', 'user-1', 'mythical_badge')
      ).rejects.toThrow('Bạn chưa mở khóa huy hiệu này!');
    });

    it('unequips badge successfully setting equippedBadge to null', async () => {
      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

      const success = await BadgeService.unequipBadge('guild-1', 'user-1');
      expect(success).toBe(true);
      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-1' },
        { $set: { equippedBadge: null } }
      );
    });
  });

  describe('User Badges Overview (getUserBadges)', () => {
    it('returns unlocked list, locked list with progress, and equipped badge', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-1',
        totalMessages: 500,
        totalVoiceSeconds: 18000, // 300 mins (5h)
        dailyStreak: 5,
        dneCoins: 8000,
        repCount: 15,
        unlockedBadges: ['chatter_100'],
        equippedBadge: 'chatter_100'
      } as any);

      const overview = await BadgeService.getUserBadges('guild-1', 'user-1');
      expect(overview.equippedBadge?.id).toBe('chatter_100');
      expect(overview.unlocked).toHaveLength(1);
      expect(overview.unlocked[0].id).toBe('chatter_100');

      expect(overview.locked).toHaveLength(9);
      const chatter1000 = overview.locked.find((b) => b.id === 'chatter_1000');
      expect(chatter1000).toBeDefined();
      expect(chatter1000?.current).toBe(500);
      expect(chatter1000?.target).toBe(1000);
    });

    it('handles user with null record gracefully', async () => {
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue(null);

      const overview = await BadgeService.getUserBadges('guild-1', 'user-1');
      expect(overview.equippedBadge).toBeNull();
      expect(overview.unlocked).toEqual([]);
      expect(overview.locked).toHaveLength(10);
    });
  });

  describe('Slash Command (/badge)', () => {
    const mockChatInteraction = (subcommand: string, options: Record<string, any> = {}, inGuild = true) => {
      return {
        guildId: inGuild ? 'guild-1' : null,
        user: { id: 'caller-1', username: 'TestUser' },
        options: {
          getSubcommand: () => subcommand,
          getString: (name: string) => options[name] ?? null
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined)
      } as unknown as ChatInputCommandInteraction;
    };

    it('rejects execution when used outside of a guild', async () => {
      const interaction = mockChatInteraction('list', {}, false);
      await handleBadgeCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: 'Lệnh này chỉ dùng được trong server!',
          ephemeral: true
        })
      );
    });

    it('handles /badge list subcommand and renders embed', async () => {
      const interaction = mockChatInteraction('list');
      vi.spyOn(BadgeService, 'getUserBadges').mockResolvedValue({
        unlocked: [
          {
            id: 'chatter_100',
            name: 'Người Hướng Ngoại',
            description: 'Gửi 100 tin nhắn trong server',
            emoji: '🥉',
            category: 'chat'
          }
        ],
        locked: [
          {
            id: 'chatter_1000',
            name: 'Bàn Phím Vàng',
            description: 'Gửi 1.000 tin nhắn trong server',
            emoji: '🥈',
            category: 'chat',
            current: 100,
            target: 1000,
            unit: 'tin nhắn',
            progressText: '100/1000'
          }
        ],
        equippedBadge: {
          id: 'chatter_100',
          name: 'Người Hướng Ngoại',
          description: 'Gửi 100 tin nhắn trong server',
          emoji: '🥉',
          category: 'chat'
        },
        totalCount: 10,
        unlockedCount: 1
      });

      await handleBadgeCommand(interaction);
      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });

    it('handles /badge equip subcommand when user owns badge', async () => {
      const interaction = mockChatInteraction('equip', { id: 'streak_7' });
      vi.spyOn(BadgeService, 'equipBadge').mockResolvedValue({
        success: true,
        badge: {
          id: 'streak_7',
          name: 'Giữ Lửa',
          description: 'Đạt chuỗi điểm danh 7 ngày /daily liên tiếp',
          emoji: '🔥',
          category: 'economy'
        }
      });

      await handleBadgeCommand(interaction);
      expect(BadgeService.equipBadge).toHaveBeenCalledWith('guild-1', 'caller-1', 'streak_7');
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Giữ Lửa')
        })
      );
    });

    it('handles /badge equip subcommand error when user does not own badge', async () => {
      const interaction = mockChatInteraction('equip', { id: 'coins_10k' });
      vi.spyOn(BadgeService, 'equipBadge').mockRejectedValue(
        new Error('Bạn chưa mở khóa huy hiệu này!')
      );

      await handleBadgeCommand(interaction);
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Bạn chưa mở khóa huy hiệu này!')
        })
      );
    });

    it('handles /badge unequip subcommand', async () => {
      const interaction = mockChatInteraction('unequip');
      vi.spyOn(BadgeService, 'unequipBadge').mockResolvedValue(true);

      await handleBadgeCommand(interaction);
      expect(BadgeService.unequipBadge).toHaveBeenCalledWith('guild-1', 'caller-1');
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('tháo huy hiệu')
        })
      );
    });

    it('registers badge slash command metadata properly', () => {
      const json = badgeSlashCommand.toJSON();
      expect(json.name).toBe('badge');
      expect(json.options).toHaveLength(3); // list, equip, unequip subcommands
    });
  });
});
