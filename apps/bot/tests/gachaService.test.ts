import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { UserStatModel } from '../src/models/UserStat';
import { GachaService } from '../src/services/economy/GachaService';
import {
  handleGachaCommand,
  createGachaResultEmbed,
  createGachaErrorEmbed,
  GACHA_COLORS,
  gachaSlashCommand
} from '../src/commands/gacha';

function mockInteraction(options: {
  guildId?: string | null;
  userId?: string;
  username?: string;
  avatarUrl?: string;
} = {}) {
  const {
    guildId = 'guild-1',
    userId = 'user-1',
    username = 'LuckyPlayer',
    avatarUrl = 'https://example.com/avatar.png'
  } = options;

  return {
    guildId,
    user: {
      id: userId,
      username,
      displayAvatarURL: vi.fn().mockReturnValue(avatarUrl)
    },
    options: {
      getSubcommand: vi.fn().mockReturnValue('spin')
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined)
  } as unknown as ChatInputCommandInteraction;
}

describe('GachaService.isFreeRollAvailable', () => {
  it('returns true if user has never spun (lastGachaAt is undefined)', () => {
    expect(GachaService.isFreeRollAvailable(undefined, new Date())).toBe(true);
  });

  it('returns false if lastGachaAt is less than 24 hours ago', () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    const recentSpin = new Date('2026-10-01T00:00:01.000Z'); // ~12h ago
    expect(GachaService.isFreeRollAvailable(recentSpin, now)).toBe(false);

    const justBefore24h = new Date(now.getTime() - 24 * 3600 * 1000 + 1000); // 23h 59m 59s ago
    expect(GachaService.isFreeRollAvailable(justBefore24h, now)).toBe(false);
  });

  it('returns true if lastGachaAt was exactly or more than 24 hours ago', () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    const exactly24hAgo = new Date(now.getTime() - 24 * 3600 * 1000);
    expect(GachaService.isFreeRollAvailable(exactly24hAgo, now)).toBe(true);

    const twoDaysAgo = new Date(now.getTime() - 48 * 3600 * 1000);
    expect(GachaService.isFreeRollAvailable(twoDaysAgo, now)).toBe(true);
  });
});

describe('GachaService.selectDrop', () => {
  it('correctly maps Common rarity when roll < 0.50 (50% weight)', () => {
    const mockRng = vi.fn()
      .mockReturnValueOnce(0.2) // rarity roll: 0.2 < 0.50 -> COMMON
      .mockReturnValueOnce(0.5); // coin roll: Math.floor(0.5 * 31) + 20 = 15 + 20 = 35

    const drop = GachaService.selectDrop(0, mockRng);
    expect(drop.rarity).toBe('COMMON');
    expect(drop.rewardCoins).toBeGreaterThanOrEqual(20);
    expect(drop.rewardCoins).toBeLessThanOrEqual(50);
    expect(drop.rewardCoins).toBe(35);
    expect(drop.rewardXp).toBe(0);
    expect(drop.isPityGuaranteed).toBe(false);
  });

  it('correctly maps Uncommon rarity when 0.50 <= roll < 0.75 (25% weight)', () => {
    const mockRng = vi.fn()
      .mockReturnValueOnce(0.6) // rarity roll: 0.50 <= 0.6 < 0.75 -> UNCOMMON
      .mockReturnValueOnce(0.1); // coin roll: Math.floor(0.1 * 71) + 80 = 7 + 80 = 87

    const drop = GachaService.selectDrop(10, mockRng);
    expect(drop.rarity).toBe('UNCOMMON');
    expect(drop.rewardCoins).toBeGreaterThanOrEqual(80);
    expect(drop.rewardCoins).toBeLessThanOrEqual(150);
    expect(drop.rewardCoins).toBe(87);
    expect(drop.rewardXp).toBe(0);
    expect(drop.isPityGuaranteed).toBe(false);
  });

  it('correctly maps Rare rarity when 0.75 <= roll < 0.90 (15% weight)', () => {
    const mockRng = vi.fn()
      .mockReturnValueOnce(0.8) // rarity roll: 0.75 <= 0.8 < 0.90 -> RARE
      .mockReturnValueOnce(0.5); // coin roll: Math.floor(0.5 * 101) + 200 = 50 + 200 = 250

    const drop = GachaService.selectDrop(20, mockRng);
    expect(drop.rarity).toBe('RARE');
    expect(drop.rewardCoins).toBeGreaterThanOrEqual(200);
    expect(drop.rewardCoins).toBeLessThanOrEqual(300);
    expect(drop.rewardCoins).toBe(250);
    expect(drop.rewardXp).toBe(50);
    expect(drop.isPityGuaranteed).toBe(false);
  });

  it('correctly maps Epic rarity when 0.90 <= roll < 0.98 (8% weight)', () => {
    const mockRng = vi.fn().mockReturnValue(0.92);

    const drop = GachaService.selectDrop(30, mockRng);
    expect(drop.rarity).toBe('EPIC');
    expect(drop.rewardCoins).toBe(500);
    expect(drop.rewardXp).toBe(100);
    expect(drop.isPityGuaranteed).toBe(false);
  });

  it('correctly maps Legendary rarity when roll >= 0.98 (2% weight)', () => {
    const mockRng = vi.fn().mockReturnValue(0.99);

    const drop = GachaService.selectDrop(40, mockRng);
    expect(drop.rarity).toBe('LEGENDARY');
    expect(drop.rewardCoins).toBe(1000);
    expect(drop.rewardXp).toBe(250);
    expect(drop.isPityGuaranteed).toBe(false);
  });

  describe('Pity guarantee mechanics (pity >= 50)', () => {
    it('triggers guaranteed Epic when pity >= 50 and pity roll < 0.80 (80% pity rate)', () => {
      const mockRng = vi.fn().mockReturnValue(0.4); // roll < 0.80 -> EPIC

      const drop = GachaService.selectDrop(50, mockRng);
      expect(drop.isPityGuaranteed).toBe(true);
      expect(drop.rarity).toBe('EPIC');
      expect(drop.rewardCoins).toBe(500);
      expect(drop.rewardXp).toBe(100);
    });

    it('triggers guaranteed Legendary when pity >= 50 and pity roll >= 0.80 (20% pity rate)', () => {
      const mockRng = vi.fn().mockReturnValue(0.85); // roll >= 0.80 -> LEGENDARY

      const drop = GachaService.selectDrop(55, mockRng);
      expect(drop.isPityGuaranteed).toBe(true);
      expect(drop.rarity).toBe('LEGENDARY');
      expect(drop.rewardCoins).toBe(1000);
      expect(drop.rewardXp).toBe(250);
    });

    it('never drops Common, Uncommon, or Rare when pity >= 50 regardless of low roll value', () => {
      const mockRng = vi.fn().mockReturnValue(0.01);

      const drop = GachaService.selectDrop(50, mockRng);
      expect(drop.isPityGuaranteed).toBe(true);
      expect(drop.rarity).toBe('EPIC');
      expect(['EPIC', 'LEGENDARY']).toContain(drop.rarity);
    });
  });

  it('approximates expected statistical distribution over 10,000 iterations', () => {
    const counts: Record<string, number> = {
      COMMON: 0,
      UNCOMMON: 0,
      RARE: 0,
      EPIC: 0,
      LEGENDARY: 0
    };

    const TOTAL = 10000;
    for (let i = 0; i < TOTAL; i++) {
      const drop = GachaService.selectDrop(0);
      counts[drop.rarity]++;
    }

    // Common ~50% (allow 46% - 54%)
    expect(counts.COMMON / TOTAL).toBeGreaterThan(0.46);
    expect(counts.COMMON / TOTAL).toBeLessThan(0.54);

    // Uncommon ~25% (allow 22% - 28%)
    expect(counts.UNCOMMON / TOTAL).toBeGreaterThan(0.22);
    expect(counts.UNCOMMON / TOTAL).toBeLessThan(0.28);

    // Rare ~15% (allow 12% - 18%)
    expect(counts.RARE / TOTAL).toBeGreaterThan(0.12);
    expect(counts.RARE / TOTAL).toBeLessThan(0.18);

    // Epic ~8% (allow 6% - 10.5%)
    expect(counts.EPIC / TOTAL).toBeGreaterThan(0.06);
    expect(counts.EPIC / TOTAL).toBeLessThan(0.105);

    // Legendary ~2% (allow 1% - 3.5%)
    expect(counts.LEGENDARY / TOTAL).toBeGreaterThan(0.01);
    expect(counts.LEGENDARY / TOTAL).toBeLessThan(0.035);
  });
});

describe('GachaService.spin', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('performs free spin on first attempt, updates lastGachaAt and increments pity on non-epic roll', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValueOnce(null);

    vi.spyOn(GachaService, 'selectDrop').mockReturnValueOnce({
      rarity: 'COMMON',
      rewardCoins: 30,
      rewardXp: 0,
      isPityGuaranteed: false
    });

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'user-1',
      dneCoins: 30,
      gachaPity: 1,
      lastGachaAt: now
    } as any);

    const result = await GachaService.spin({
      guildId: 'guild-1',
      userId: 'user-1',
      username: 'Alice',
      now
    });

    expect(result.isFree).toBe(true);
    expect(result.cost).toBe(0);
    expect(result.rarity).toBe('COMMON');
    expect(result.rewardCoins).toBe(30);
    expect(result.newBalance).toBe(30);
    expect(result.pity).toBe(1);
    expect(result.isPityGuaranteed).toBe(false);

    expect(updateSpy).toHaveBeenCalledWith(
      { guildId: 'guild-1', userId: 'user-1' },
      expect.objectContaining({
        $inc: { dneCoins: 30 },
        $set: expect.objectContaining({
          lastGachaAt: now,
          gachaPity: 1,
          updatedAt: now
        }),
        $setOnInsert: expect.objectContaining({
          username: 'Alice'
        })
      }),
      { upsert: true, new: true }
    );
  });

  it('rejects paid spin if cooldown < 24h and balance < 200 coins with exact error message', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    const recentGachaAt = new Date('2026-10-01T06:00:00.000Z'); // 6 hours ago

    vi.spyOn(UserStatModel, 'findOne').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'user-1',
      dneCoins: 150,
      gachaPity: 10,
      lastGachaAt: recentGachaAt
    } as any);

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');

    await expect(
      GachaService.spin({
        guildId: 'guild-1',
        userId: 'user-1',
        now
      })
    ).rejects.toThrow('Bạn không đủ DNE Coins! Cần 200 xu cho lượt quay này. Số dư hiện tại: 150 xu');

    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('performs paid spin when balance >= 200 coins, deducts 200 and does NOT update lastGachaAt', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    const previousGachaAt = new Date('2026-10-01T06:00:00.000Z'); // 6 hours ago

    vi.spyOn(UserStatModel, 'findOne').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'user-1',
      dneCoins: 500,
      gachaPity: 15,
      lastGachaAt: previousGachaAt
    } as any);

    vi.spyOn(GachaService, 'selectDrop').mockReturnValueOnce({
      rarity: 'RARE',
      rewardCoins: 250,
      rewardXp: 50,
      isPityGuaranteed: false
    });

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'user-1',
      dneCoins: 550, // 500 - 200 + 250 = 550
      gachaPity: 16,
      lastGachaAt: previousGachaAt
    } as any);

    const result = await GachaService.spin({
      guildId: 'guild-1',
      userId: 'user-1',
      now
    });

    expect(result.isFree).toBe(false);
    expect(result.cost).toBe(200);
    expect(result.rarity).toBe('RARE');
    expect(result.rewardCoins).toBe(250);
    expect(result.rewardXp).toBe(50);
    expect(result.newBalance).toBe(550);
    expect(result.pity).toBe(16);

    // Verify lastGachaAt is not in $set for paid rolls
    const updateCall = updateSpy.mock.calls[0];
    const updateArg = updateCall[1] as any;
    expect(updateArg.$set.lastGachaAt).toBeUndefined();
    expect(updateArg.$inc).toEqual({
      dneCoins: 50, // +250 - 200 = +50
      exp: 50
    });
    expect(updateArg.$set.gachaPity).toBe(16);
  });

  it('resets pity to 0 when Epic is rolled normally', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');

    vi.spyOn(UserStatModel, 'findOne').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'user-1',
      dneCoins: 1000,
      gachaPity: 45,
      lastGachaAt: new Date(now.getTime() - 25 * 3600 * 1000) // free roll available
    } as any);

    vi.spyOn(GachaService, 'selectDrop').mockReturnValueOnce({
      rarity: 'EPIC',
      rewardCoins: 500,
      rewardXp: 100,
      isPityGuaranteed: false
    });

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'user-1',
      dneCoins: 1500,
      gachaPity: 0
    } as any);

    const result = await GachaService.spin({
      guildId: 'guild-1',
      userId: 'user-1',
      now
    });

    expect(result.rarity).toBe('EPIC');
    expect(result.pity).toBe(0);
    const updateArg = updateSpy.mock.calls[0][1] as any;
    expect(updateArg.$set.gachaPity).toBe(0);
  });

  it('resets pity to 0 when pity guarantee triggers on Legendary drop', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');

    vi.spyOn(UserStatModel, 'findOne').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'user-1',
      dneCoins: 1000,
      gachaPity: 50,
      lastGachaAt: new Date(now.getTime() - 1000) // paid roll
    } as any);

    vi.spyOn(GachaService, 'selectDrop').mockReturnValueOnce({
      rarity: 'LEGENDARY',
      rewardCoins: 1000,
      rewardXp: 250,
      isPityGuaranteed: true
    });

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'user-1',
      dneCoins: 1800, // 1000 - 200 + 1000 = 1800
      gachaPity: 0
    } as any);

    const result = await GachaService.spin({
      guildId: 'guild-1',
      userId: 'user-1',
      now
    });

    expect(result.rarity).toBe('LEGENDARY');
    expect(result.isPityGuaranteed).toBe(true);
    expect(result.pity).toBe(0);
    expect(result.newBalance).toBe(1800);
    const updateArg = updateSpy.mock.calls[0][1] as any;
    expect(updateArg.$set.gachaPity).toBe(0);
  });
});

describe('/gacha slash command (handleGachaCommand)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('has valid slash command configuration with subcommand spin', () => {
    expect(gachaSlashCommand.name).toBe('gacha');
    const json = gachaSlashCommand.toJSON();
    expect(json.options?.[0]?.name).toBe('spin');
  });

  it('rejects execution outside a guild (DM) with ephemeral message', async () => {
    const interaction = mockInteraction({ guildId: null });

    await handleGachaCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Lệnh này chỉ dùng trong server Discord.',
      ephemeral: true
    });
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('successfully executes /gacha spin for free roll and renders success embed', async () => {
    const interaction = mockInteraction({
      guildId: 'guild-1',
      userId: 'user-123'
    });

    vi.spyOn(GachaService, 'spin').mockResolvedValueOnce({
      rarity: 'RARE',
      rewardCoins: 250,
      rewardXp: 50,
      isFree: true,
      cost: 0,
      newBalance: 750,
      pity: 5,
      isPityGuaranteed: false
    });

    await handleGachaCommand(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({
      embeds: [expect.any(Object)]
    });

    const editCall = (interaction.editReply as any).mock.calls[0][0];
    const embed = editCall.embeds[0].data;

    expect(embed.color).toBe(GACHA_COLORS.RARE);
    expect(embed.title).toContain('Gacha');
    expect(embed.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: expect.stringContaining('Phẩm cấp'), value: expect.stringContaining('Quý') }),
        expect.objectContaining({ name: expect.stringContaining('Phần thưởng'), value: expect.stringContaining('250 DNE Coins') }),
        expect.objectContaining({ name: expect.stringContaining('Chi phí'), value: expect.stringContaining('Miễn phí') }),
        expect.objectContaining({ name: expect.stringContaining('Số dư mới'), value: expect.stringContaining('750 DNE Coins') }),
        expect.objectContaining({ name: expect.stringContaining('Bảo hiểm'), value: expect.stringContaining('5/50') })
      ])
    );
  });

  it('handles insufficient funds error cleanly by displaying error embed', async () => {
    const interaction = mockInteraction({
      guildId: 'guild-1',
      userId: 'user-123'
    });

    vi.spyOn(GachaService, 'spin').mockRejectedValueOnce(
      new Error('Bạn không đủ DNE Coins! Cần 200 xu cho lượt quay này. Số dư hiện tại: 50 xu')
    );

    await handleGachaCommand(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith({
      embeds: [expect.any(Object)]
    });

    const editCall = (interaction.editReply as any).mock.calls[0][0];
    const embed = editCall.embeds[0].data;

    expect(embed.color).toBe(0xed4245);
    expect(embed.description).toContain('Bạn không đủ DNE Coins! Cần 200 xu cho lượt quay này. Số dư hiện tại: 50 xu');
  });

  it('handles unexpected exceptions cleanly without throwing unhandled rejection', async () => {
    const interaction = mockInteraction({
      guildId: 'guild-1',
      userId: 'user-123'
    });

    vi.spyOn(GachaService, 'spin').mockRejectedValueOnce(new Error('Mongo connection failure'));

    await expect(handleGachaCommand(interaction)).resolves.not.toThrow();

    expect(interaction.editReply).toHaveBeenCalledWith({
      embeds: [expect.any(Object)]
    });
  });
});

describe('Embed Builder Helpers', () => {
  it('creates correct embed for Epic rarity with pity guarantee badge', () => {
    const embed = createGachaResultEmbed({
      userId: 'user-77',
      result: {
        rarity: 'EPIC',
        rewardCoins: 500,
        rewardXp: 100,
        isFree: false,
        cost: 200,
        newBalance: 1200,
        pity: 0,
        isPityGuaranteed: true
      },
      avatarUrl: 'https://example.com/pic.png'
    });

    const data = embed.toJSON();
    expect(data.color).toBe(GACHA_COLORS.EPIC);
    expect(data.description).toContain('<@user-77>');
    const rarityField = data.fields?.find((f) => f.name.includes('Phẩm cấp'));
    expect(rarityField?.value).toContain('Sử Thi');
    expect(rarityField?.value).toContain('Bảo hiểm');
  });

  it('creates correct error embed', () => {
    const errorEmbed = createGachaErrorEmbed('Lỗi hệ thống');
    const data = errorEmbed.toJSON();
    expect(data.color).toBe(0xed4245);
    expect(data.description).toBe('Lỗi hệ thống');
  });
});
