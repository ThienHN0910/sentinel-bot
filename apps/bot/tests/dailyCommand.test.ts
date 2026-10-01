import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { UserStatModel } from '../src/models/UserStat';
import { EconomyService } from '../src/services/economy/EconomyService';
import {
  handleDailyCommand,
  createDailyEmbed,
  createCooldownEmbed,
  renderStreakBar,
  formatCooldownTime
} from '../src/commands/daily';

function mockInteraction(guildId: string | null = 'guild-1', userId = 'user-1', username = 'Alice') {
  return {
    guildId,
    user: { id: userId, username },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined)
  } as unknown as ChatInputCommandInteraction;
}

describe('EconomyService.getDailyStatus', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns eligible status for new user without prior record', async () => {
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue(null);

    const status = await EconomyService.getDailyStatus('guild-1', 'user-1');
    expect(status.canClaim).toBe(true);
    expect(status.hoursRemaining).toBe(0);
    expect(status.minutesRemaining).toBe(0);
    expect(status.currentStreak).toBe(0);
    expect(status.dneCoins).toBe(0);
  });

  it('calculates remaining cooldown accurately when user claimed recently (< 20h)', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    // Claimed 5 hours and 35 minutes ago -> 14h 25m remaining
    const lastDailyAt = new Date(now.getTime() - (5 * 3600 + 35 * 60) * 1000);

    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
      guildId: 'guild-1',
      userId: 'user-1',
      dailyStreak: 3,
      lastDailyAt,
      dneCoins: 500
    } as any);

    const status = await EconomyService.getDailyStatus('guild-1', 'user-1', now);
    expect(status.canClaim).toBe(false);
    expect(status.hoursRemaining).toBe(14);
    expect(status.minutesRemaining).toBe(25);
    expect(status.currentStreak).toBe(3);
    expect(status.dneCoins).toBe(500);
  });

  it('indicates streak is broken when more than 48h have elapsed since last daily claim', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');
    // Claimed 50 hours ago
    const lastDailyAt = new Date(now.getTime() - 50 * 3600 * 1000);

    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
      guildId: 'guild-1',
      userId: 'user-1',
      dailyStreak: 5,
      lastDailyAt,
      dneCoins: 800
    } as any);

    const status = await EconomyService.getDailyStatus('guild-1', 'user-1', now);
    expect(status.canClaim).toBe(true);
    expect(status.hoursRemaining).toBe(0);
    expect(status.minutesRemaining).toBe(0);
    expect(status.currentStreak).toBe(0);
    expect(status.dneCoins).toBe(800);
  });
});

describe('Streak visualization & Embed helpers', () => {
  it('renders streak progress bar correctly', () => {
    expect(renderStreakBar(1)).toBe('🔥 Chuỗi: 1/7 ngày [█░░░░░░]');
    expect(renderStreakBar(5)).toBe('🔥 Chuỗi: 5/7 ngày [█████░░]');
    expect(renderStreakBar(7)).toBe('🔥 Chuỗi: 7/7 ngày [███████]');
  });

  it('formats remaining cooldown nicely', () => {
    expect(formatCooldownTime(14, 25)).toBe('14 giờ 25 phút');
    expect(formatCooldownTime(0, 45)).toBe('45 phút');
    expect(formatCooldownTime(10, 0)).toBe('10 giờ 0 phút');
  });

  it('creates success embed with streak flame, progress bar and bonus coins', () => {
    const embed = createDailyEmbed(5, 140, 1140);
    const data = embed.data;

    expect(data.title).toContain('Điểm Danh');
    expect(data.description).toContain('🔥 Chuỗi: 5/7 ngày [█████░░]');
    expect(data.fields).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'Phần thưởng', value: '+140 DNE Coins' }),
        expect.objectContaining({ name: 'Tổng số dư', value: expect.stringContaining('1.140 DNE Coins') })
      ])
    );
  });

  it('creates cooldown embed with formatted remaining time', () => {
    const embed = createCooldownEmbed(14, 25, 3);
    const data = embed.data;

    expect(data.title).toContain('Điểm danh');
    expect(data.description).toContain('14 giờ 25 phút');
    expect(data.description).toContain('🔥 Chuỗi: 3/7 ngày [███░░░░]');
  });
});

describe('/daily slash command (handleDailyCommand)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('claims daily when eligible and returns success embed with streak flame and bonus coins', async () => {
    const lastDailyAt = new Date(Date.now() - 24 * 3600 * 1000);
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
      guildId: 'guild-1',
      userId: 'user-1',
      dailyStreak: 2,
      lastDailyAt,
      dneCoins: 300
    } as any);

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

    const interaction = mockInteraction('guild-1', 'user-1', 'Alice');
    await handleDailyCommand(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();

    const editArgs = vi.mocked(interaction.editReply).mock.calls[0][0] as { embeds: any[] };
    expect(editArgs.embeds).toBeDefined();
    expect(editArgs.embeds.length).toBe(1);

    const embed = editArgs.embeds[0].data;
    expect(embed.description).toContain('🔥 Chuỗi: 3/7 ngày [███░░░░]');

    const rewardField = embed.fields?.find((f: any) => f.name === 'Phần thưởng');
    expect(rewardField?.value).toBe('+120 DNE Coins');

    const balanceField = embed.fields?.find((f: any) => f.name === 'Tổng số dư');
    expect(balanceField?.value).toContain('420 DNE Coins');

    expect(updateSpy).toHaveBeenCalledWith(
      { guildId: 'guild-1', userId: 'user-1' },
      expect.objectContaining({
        $inc: { dneCoins: 120 },
        $set: expect.objectContaining({ dailyStreak: 3 })
      }),
      { upsert: true }
    );
  });

  it('claims daily when on cooldown (< 20h) and returns cooldown embed with remaining time without throwing unhandled error', async () => {
    // Claimed 5 hours and 35 minutes ago -> remaining ~14h 25m
    const lastDailyAt = new Date(Date.now() - (5 * 3600 + 35 * 60) * 1000);
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
      guildId: 'guild-1',
      userId: 'user-1',
      dailyStreak: 3,
      lastDailyAt,
      dneCoins: 500
    } as any);

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');

    const interaction = mockInteraction('guild-1', 'user-1', 'Alice');

    // Must not throw unhandled exception
    await expect(handleDailyCommand(interaction)).resolves.not.toThrow();

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();

    // Must not mutate database when on cooldown
    expect(updateSpy).not.toHaveBeenCalled();

    const editArgs = vi.mocked(interaction.editReply).mock.calls[0][0] as { embeds: any[] };
    expect(editArgs.embeds).toBeDefined();
    expect(editArgs.embeds.length).toBe(1);

    const embed = editArgs.embeds[0].data;
    expect(embed.title).toMatch(/Điểm danh/i);
    expect(embed.description).toMatch(/14 giờ 2[45] phút/); // allow 1 minute tolerance
    expect(embed.description).toContain('🔥 Chuỗi: 3/7 ngày [███░░░░]');
  });

  it('breaks streak if > 48h since lastDailyAt', async () => {
    // Claimed 50 hours ago with previous streak of 5
    const lastDailyAt = new Date(Date.now() - 50 * 3600 * 1000);
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
      guildId: 'guild-1',
      userId: 'user-1',
      dailyStreak: 5,
      lastDailyAt,
      dneCoins: 1000
    } as any);

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

    const interaction = mockInteraction('guild-1', 'user-1', 'Alice');
    await handleDailyCommand(interaction);

    expect(interaction.editReply).toHaveBeenCalled();

    const editArgs = vi.mocked(interaction.editReply).mock.calls[0][0] as { embeds: any[] };
    const embed = editArgs.embeds[0].data;

    // Streak should reset to 1
    expect(embed.description).toContain('🔥 Chuỗi: 1/7 ngày [█░░░░░░]');

    const rewardField = embed.fields?.find((f: any) => f.name === 'Phần thưởng');
    expect(rewardField?.value).toBe('+100 DNE Coins');

    expect(updateSpy).toHaveBeenCalledWith(
      { guildId: 'guild-1', userId: 'user-1' },
      expect.objectContaining({
        $inc: { dneCoins: 100 },
        $set: expect.objectContaining({ dailyStreak: 1 })
      }),
      { upsert: true }
    );
  });

  it('rejects execution outside of guild (DM) with ephemeral message', async () => {
    const interaction = mockInteraction(null);
    await handleDailyCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Lệnh này chỉ dùng trong server Discord.',
      ephemeral: true
    });
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });
});
