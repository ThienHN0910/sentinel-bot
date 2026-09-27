import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calculateDailyStreak, EconomyService, expForLevel, calculateLevel, LevelService } from '../src/services/economy/EconomyService';
import { ReminderService } from '../src/services/reminder/ReminderService';
import { UserStatModel } from '../src/models/UserStat';
import { ReminderModel } from '../src/models/Reminder';

describe('Daily Claim Streak Calculation', () => {
  it('increments streak if claimed within 24-48 hours', () => {
    const yesterday = new Date(Date.now() - 26 * 3600 * 1000);
    const result = calculateDailyStreak(3, yesterday);
    expect(result.newStreak).toBe(4);
    expect(result.rewardCoins).toBe(130); // 100 + 10% * 3
  });

  it('resets streak to 1 if more than 48 hours have passed', () => {
    const threeDaysAgo = new Date(Date.now() - 72 * 3600 * 1000);
    const result = calculateDailyStreak(5, threeDaysAgo);
    expect(result.newStreak).toBe(1);
    expect(result.rewardCoins).toBe(100);
  });

  it('initializes streak to 1 and 100 reward coins if user has no previous daily claim', () => {
    const result = calculateDailyStreak(0, undefined);
    expect(result.newStreak).toBe(1);
    expect(result.rewardCoins).toBe(100);
  });

  it('throws an error if user attempts to claim again before 20 hours cooldown', () => {
    const tenHoursAgo = new Date(Date.now() - 10 * 3600 * 1000);
    expect(() => calculateDailyStreak(2, tenHoursAgo)).toThrow(
      'Bạn đã nhận điểm danh hôm nay rồi! Hãy quay lại sau.'
    );
  });

  it('caps streak at 7 with maximum bonus (160 coins)', () => {
    const yesterday = new Date(Date.now() - 24 * 3600 * 1000);
    const result = calculateDailyStreak(7, yesterday);
    expect(result.newStreak).toBe(7);
    expect(result.rewardCoins).toBe(160); // 100 + (7 - 1) * 10 = 160
  });

  it('accepts explicit reference date for deterministic testing', () => {
    const baseTime = new Date('2026-09-27T12:00:00.000Z');
    const claimTime = new Date('2026-09-26T14:00:00.000Z'); // 22 hours earlier
    const result = calculateDailyStreak(2, claimTime, baseTime);
    expect(result.newStreak).toBe(3);
    expect(result.rewardCoins).toBe(120);
  });
});

describe('EconomyService - claimDaily & transfer', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('claims daily reward and updates user streak and coins in database', async () => {
    const lastDailyAt = new Date(Date.now() - 25 * 3600 * 1000);
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
      dailyStreak: 2,
      lastDailyAt,
      dneCoins: 300
    } as any);

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

    const result = await EconomyService.claimDaily('guild-1', 'user-1');
    expect(result.streak).toBe(3);
    expect(result.reward).toBe(120);

    expect(updateSpy).toHaveBeenCalledWith(
      { guildId: 'guild-1', userId: 'user-1' },
      expect.objectContaining({
        $inc: { dneCoins: 120 },
        $set: expect.objectContaining({ dailyStreak: 3 })
      }),
      { upsert: true }
    );
  });

  it('propagates cooldown error when claiming before 20 hours', async () => {
    const lastDailyAt = new Date(Date.now() - 5 * 3600 * 1000);
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
      dailyStreak: 1,
      lastDailyAt
    } as any);

    await expect(EconomyService.claimDaily('guild-1', 'user-1')).rejects.toThrow(
      'Bạn đã nhận điểm danh hôm nay rồi! Hãy quay lại sau.'
    );
  });

  it('transfers coins between users when sender has sufficient balance', async () => {
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
      userId: 'sender-1',
      guildId: 'guild-1',
      dneCoins: 500
    } as any);

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

    const success = await EconomyService.transferCoins('guild-1', 'sender-1', 'receiver-1', 200);
    expect(success).toBe(true);

    expect(updateSpy).toHaveBeenCalledWith(
      { guildId: 'guild-1', userId: 'sender-1' },
      { $inc: { dneCoins: -200 } }
    );
    expect(updateSpy).toHaveBeenCalledWith(
      { guildId: 'guild-1', userId: 'receiver-1' },
      expect.objectContaining({ $inc: { dneCoins: 200 } }),
      { upsert: true }
    );
  });

  it('supports transfer alias method', async () => {
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
      userId: 'sender-1',
      guildId: 'guild-1',
      dneCoins: 500
    } as any);
    vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);

    const success = await EconomyService.transfer('guild-1', 'sender-1', 'receiver-1', 100);
    expect(success).toBe(true);
  });

  it('rejects transfer with amount <= 0', async () => {
    await expect(
      EconomyService.transferCoins('guild-1', 'sender-1', 'receiver-1', 0)
    ).rejects.toThrow('Số xu chuyển phải lớn hơn 0');

    await expect(
      EconomyService.transferCoins('guild-1', 'sender-1', 'receiver-1', -50)
    ).rejects.toThrow('Số xu chuyển phải lớn hơn 0');
  });

  it('rejects transfer if sender has insufficient balance', async () => {
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
      userId: 'sender-1',
      guildId: 'guild-1',
      dneCoins: 50
    } as any);

    await expect(
      EconomyService.transferCoins('guild-1', 'sender-1', 'receiver-1', 100)
    ).rejects.toThrow('Số dư của bạn không đủ để thực hiện giao dịch!');
  });
});

describe('ReminderService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    ReminderService.stopPolling();
  });

  it('creates a reminder with pending status', async () => {
    const createSpy = vi.spyOn(ReminderModel, 'create').mockResolvedValue({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      message: 'Họp team',
      remindAt: new Date(),
      status: 'pending'
    } as any);

    const rem = await ReminderService.createReminder({
      userId: 'user-1',
      guildId: 'guild-1',
      channelId: 'channel-1',
      message: 'Họp team',
      remindAt: new Date()
    });

    expect(createSpy).toHaveBeenCalled();
    expect(rem.status).toBe('pending');
  });

  it('polls due reminders, updates status to completed, and sends notification to channel', async () => {
    const saveMock = vi.fn().mockResolvedValue(true);
    const mockReminder = {
      _id: 'rem-1',
      userId: 'user-123',
      channelId: 'chan-456',
      message: 'Đi uống nước',
      status: 'pending',
      save: saveMock
    };

    const mockLimit = vi.fn().mockResolvedValue([mockReminder]);
    vi.spyOn(ReminderModel, 'find').mockReturnValue({ limit: mockLimit } as any);

    const mockSend = vi.fn().mockResolvedValue(true);
    const mockClient = {
      channels: {
        fetch: vi.fn().mockResolvedValue({ send: mockSend })
      }
    } as any;

    const processed = await ReminderService.pollReminders(mockClient);

    expect(processed).toHaveLength(1);
    expect(mockReminder.status).toBe('completed');
    expect(saveMock).toHaveBeenCalled();
    expect(mockClient.channels.fetch).toHaveBeenCalledWith('chan-456');
    expect(mockSend).toHaveBeenCalledWith('⏰ <@user-123> **NHẮC NHỞ:** Đi uống nước');
  });

  it('handles channel fetch error gracefully during poll', async () => {
    const saveMock = vi.fn().mockResolvedValue(true);
    const mockReminder = {
      _id: 'rem-2',
      userId: 'user-999',
      channelId: 'deleted-chan',
      message: 'Làm bài tập',
      status: 'pending',
      save: saveMock
    };

    const mockLimit = vi.fn().mockResolvedValue([mockReminder]);
    vi.spyOn(ReminderModel, 'find').mockReturnValue({ limit: mockLimit } as any);

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const mockClient = {
      channels: {
        fetch: vi.fn().mockRejectedValue(new Error('Channel not found'))
      }
    } as any;

    await expect(ReminderService.pollReminders(mockClient)).resolves.not.toThrow();
    expect(mockReminder.status).toBe('completed');
    expect(saveMock).toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();
  });

  it('starts and stops interval timer', () => {
    vi.useFakeTimers();
    const pollSpy = vi.spyOn(ReminderService, 'pollReminders').mockResolvedValue([] as any);
    const mockClient = {} as any;

    ReminderService.startPolling(mockClient, 1000);
    vi.advanceTimersByTime(1000);
    expect(pollSpy).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(2000);
    expect(pollSpy).toHaveBeenCalledTimes(3);

    ReminderService.stopPolling();
    vi.advanceTimersByTime(2000);
    expect(pollSpy).toHaveBeenCalledTimes(3);
    vi.useRealTimers();
  });
});

describe('Leveling Math & LevelService', () => {
  it('calculates EXP required for Level L using formula 100 * L^1.5', () => {
    expect(expForLevel(1)).toBe(100);
    expect(expForLevel(2)).toBe(282); // 100 * 2^1.5 = 282.84 -> 282
    expect(expForLevel(3)).toBe(519); // 100 * 3^1.5 = 519.61 -> 519
  });

  it('determines user level based on accumulated EXP', () => {
    expect(calculateLevel(50)).toBe(1);
    expect(calculateLevel(100)).toBe(1);
    expect(calculateLevel(281)).toBe(1);
    expect(calculateLevel(282)).toBe(2);
    expect(calculateLevel(520)).toBe(3);
  });

  it('exposes LevelService wrapper methods', () => {
    expect(LevelService.expForLevel(2)).toBe(282);
    expect(LevelService.calculateLevel(300)).toBe(2);
  });
});
