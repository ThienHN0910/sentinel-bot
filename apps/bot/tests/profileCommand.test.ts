import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  profileSlashCommand,
  formatExpBar,
  createProfileEmbed,
  createProfileButtons,
  handleProfileCommand,
  handleProfileButton
} from '../src/commands/profile';
import { UserStatModel } from '../src/models/UserStat';
import { BadgeService } from '../src/services/badge/BadgeService';
import { PetService } from '../src/services/pet/PetService';

vi.mock('../src/models/UserStat', () => ({
  UserStatModel: {
    findOne: vi.fn()
  }
}));

vi.mock('../src/services/badge/BadgeService', () => ({
  BADGE_CATALOG: [
    {
      id: 'streak_7',
      name: 'Giữ Lửa',
      description: 'Đạt chuỗi điểm danh 7 ngày /daily liên tiếp',
      emoji: '🔥',
      category: 'economy'
    }
  ],
  BadgeService: {
    evaluateBadges: vi.fn(),
    getBadge: vi.fn(),
    getUserBadges: vi.fn()
  }
}));

vi.mock('../src/services/pet/PetService', () => ({
  PetService: {
    getPet: vi.fn(),
    getPetTypeEmoji: vi.fn((type: string) => (type === 'cat' ? '🐱' : '🐾')),
    getPetTypeName: vi.fn((type: string) => (type === 'cat' ? 'Mèo' : 'Thú cưng'))
  }
}));

function createMockChatInputInteraction(options: {
  guildId?: string | null;
  callerId?: string;
  targetUser?: any;
}) {
  const {
    guildId = 'guild-123',
    callerId = 'caller-1',
    targetUser = null
  } = options;

  return {
    isChatInputCommand: () => true,
    guildId,
    user: {
      id: callerId,
      username: 'callerUser',
      displayName: 'Caller User',
      displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/caller.png'
    },
    options: {
      getUser: vi.fn().mockImplementation((name: string) => {
        if (name === 'user') return targetUser;
        return null;
      })
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  } as any;
}

function createMockButtonInteraction(options: {
  customId: string;
  guildId?: string | null;
  userId?: string;
}) {
  const { customId, guildId = 'guild-123', userId = 'user-1' } = options;
  return {
    isButton: () => true,
    customId,
    guildId,
    user: { id: userId, username: 'testuser' },
    guild: {
      members: {
        cache: new Map([
          [
            'target-user-456',
            {
              user: {
                id: 'target-user-456',
                username: 'targetuser',
                displayName: 'Target User'
              }
            }
          ]
        ])
      }
    },
    client: {
      users: {
        fetch: vi.fn().mockResolvedValue({
          id: 'target-user-456',
          username: 'targetuser',
          displayName: 'Target User'
        })
      }
    },
    reply: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn().mockResolvedValue(undefined)
  } as any;
}

describe('Profile Command (/profile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('formatExpBar', () => {
    it('calculates progress bar for Level 1 user', () => {
      const bar = formatExpBar(0, 1);
      expect(bar).toContain('0/');
      expect(bar).toContain('(0%)');
      expect(bar).toContain('░░░░░░░░░░');
    });

    it('calculates partially filled progress bar', () => {
      // Level 1: currentLevelBase = 0, nextLevelThreshold = expForLevel(2) = 282
      const bar = formatExpBar(141, 1);
      expect(bar).toContain('141/282 XP (50%)');
      expect(bar).toContain('█████░░░░░');
    });
  });

  describe('createProfileEmbed', () => {
    const mockUser = {
      id: 'user-123',
      username: 'alice',
      displayName: 'Alice',
      displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/alice.png'
    };

    it('renders profile with default stats when userStat is null and no pet', () => {
      const embed = createProfileEmbed({
        targetUser: mockUser as any,
        userStat: null,
        petData: null
      });

      const data = embed.toJSON();
      expect(data.author?.name).toBe('Alice');
      expect(data.author?.icon_url).toBe('https://cdn.discordapp.com/avatars/alice.png');
      expect(data.fields?.length).toBe(4);

      // Level field
      const levelField = data.fields?.find((f) => f.name.includes('Cấp độ'));
      expect(levelField?.value).toContain('Cấp độ: **1**');

      // Economy field
      const ecoField = data.fields?.find((f) => f.name.includes('Tài chính'));
      expect(ecoField?.value).toContain('DNE Coins: **0** 🪙');
      expect(ecoField?.value).toContain('Uy tín: **+0** ⭐');

      // Activity field
      const actField = data.fields?.find((f) => f.name.includes('Hoạt động'));
      expect(actField?.value).toContain('Tin nhắn: **0** 💬');
      expect(actField?.value).toContain('Voice: **0.0** giờ 🎙️');
      expect(actField?.value).toContain('Chuỗi streak: **0** ngày 🔥');

      // Pet field
      const petField = data.fields?.find((f) => f.name.includes('Thú cưng'));
      expect(petField?.value).toContain('Chưa nhận nuôi thú cưng');
    });

    it('renders profile with equipped badge in author title', () => {
      vi.mocked(BadgeService.getBadge).mockReturnValue({
        id: 'streak_7',
        name: 'Giữ Lửa',
        description: 'Đạt chuỗi điểm danh 7 ngày',
        emoji: '🔥',
        category: 'economy'
      });

      const mockStat: any = {
        guildId: 'guild-123',
        userId: 'user-123',
        level: 5,
        exp: 1500,
        dneCoins: 12500,
        repCount: 15,
        totalMessages: 850,
        totalVoiceSeconds: 7200,
        dailyStreak: 7,
        equippedBadge: 'streak_7'
      };

      const embed = createProfileEmbed({
        targetUser: mockUser as any,
        userStat: mockStat,
        petData: null
      });

      const data = embed.toJSON();
      expect(data.author?.name).toBe('[🔥 Giữ Lửa] Alice');
      const ecoField = data.fields?.find((f) => f.name.includes('Tài chính'));
      expect(ecoField?.value).toContain((12500).toLocaleString('vi-VN'));
      expect(ecoField?.value).toContain('+15');
      const actField = data.fields?.find((f) => f.name.includes('Hoạt động'));
      expect(actField?.value).toContain('Voice: **2.0** giờ');
    });

    it('renders profile with active companion pet', () => {
      const mockPetData: any = {
        pet: {
          name: 'Mochi',
          petType: 'cat'
        },
        moodLabel: 'Hạnh phúc ✨',
        currentHunger: 85,
        currentHappiness: 90
      };

      const embed = createProfileEmbed({
        targetUser: mockUser as any,
        userStat: null,
        petData: mockPetData
      });

      const data = embed.toJSON();
      const petField = data.fields?.find((f) => f.name.includes('Thú cưng'));
      expect(petField?.value).toContain('🐱 **Mochi** (Mèo) — Hạnh phúc ✨');
      expect(petField?.value).toContain('No: 85/100 🥪 • Vui vẻ: 90/100 🎾');
    });
  });

  describe('handleProfileCommand', () => {
    it('rejects command if outside guild', async () => {
      const interaction = createMockChatInputInteraction({ guildId: null });
      await handleProfileCommand(interaction);
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('chỉ dùng được trong server'),
          ephemeral: true
        })
      );
    });

    it('auto-evaluates badges and renders profile for caller', async () => {
      const interaction = createMockChatInputInteraction({
        guildId: 'guild-123',
        callerId: 'caller-1'
      });

      vi.mocked(BadgeService.evaluateBadges).mockResolvedValue(['streak_7']);
      vi.mocked(UserStatModel.findOne).mockResolvedValue(null as any);
      vi.mocked(PetService.getPet).mockResolvedValue(null);

      await handleProfileCommand(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(BadgeService.evaluateBadges).toHaveBeenCalledWith('guild-123', 'caller-1');
      expect(UserStatModel.findOne).toHaveBeenCalledWith({
        guildId: 'guild-123',
        userId: 'caller-1'
      });
      expect(PetService.getPet).toHaveBeenCalledWith('guild-123', 'caller-1');
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: expect.any(Array)
        })
      );
    });

    it('renders profile for targeted user if specified in options', async () => {
      const target = {
        id: 'target-999',
        username: 'targetUser',
        displayName: 'Target User',
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/target.png'
      };
      const interaction = createMockChatInputInteraction({
        guildId: 'guild-123',
        callerId: 'caller-1',
        targetUser: target
      });

      vi.mocked(BadgeService.evaluateBadges).mockResolvedValue([]);
      vi.mocked(UserStatModel.findOne).mockResolvedValue(null as any);
      vi.mocked(PetService.getPet).mockResolvedValue(null);

      await handleProfileCommand(interaction);

      expect(BadgeService.evaluateBadges).toHaveBeenCalledWith('guild-123', 'target-999');
      expect(UserStatModel.findOne).toHaveBeenCalledWith({
        guildId: 'guild-123',
        userId: 'target-999'
      });
      expect(PetService.getPet).toHaveBeenCalledWith('guild-123', 'target-999');
    });
  });

  describe('handleProfileButton', () => {
    it('renders badge drawer for profile:badges:<targetUserId>', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'profile:badges:target-user-456',
        guildId: 'guild-123'
      });

      vi.mocked(BadgeService.getUserBadges).mockResolvedValue({
        unlocked: [],
        locked: [],
        equippedBadge: null,
        totalCount: 10,
        unlockedCount: 0
      });

      await handleProfileButton(interaction);

      expect(BadgeService.getUserBadges).toHaveBeenCalledWith('guild-123', 'target-user-456');
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          ephemeral: true
        })
      );
    });

    it('ignores button with unrelated customId', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'unrelated:button'
      });

      await handleProfileButton(interaction);

      expect(interaction.reply).not.toHaveBeenCalled();
    });
  });

  describe('profileSlashCommand registration', () => {
    it('has correct name, description, and user option', () => {
      expect(profileSlashCommand.name).toBe('profile');
      expect(profileSlashCommand.description).toContain('hồ sơ cá nhân');
      const opt = profileSlashCommand.options.find((o: any) => o.name === 'user');
      expect(opt).toBeDefined();
      expect((opt as any).required).toBe(false);
    });
  });
});
