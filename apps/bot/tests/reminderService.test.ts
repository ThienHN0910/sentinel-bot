import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReminderModel } from '../src/models/Reminder';
import { ReminderService, parseReminderDelay } from '../src/services/reminder/ReminderService';

const due = {
  _id: 'db-1', publicId: 'reminder0001', userId: 'user-1', guildId: 'guild-1',
  message: 'Họp team', remindAt: new Date('2026-09-29T00:00:00Z'),
  status: 'sending', claimedAt: new Date('2026-09-29T01:00:00Z'), attempts: 1
};

describe('private reminder lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(ReminderModel, 'find').mockReturnValue({ limit: vi.fn().mockResolvedValue([]) } as never);
    vi.spyOn(ReminderModel, 'updateMany').mockResolvedValue({ modifiedCount: 0 } as never);
  });
  afterEach(() => ReminderService.stopPolling());

  it('parses only durations from one minute through seven days', () => {
    expect(parseReminderDelay('1m')).toBe(60_000);
    expect(parseReminderDelay('7d')).toBe(604_800_000);
    for (const value of ['0m', '8d', ' 1m', '1m ', '999999999999999999d', '1w']) {
      expect(() => parseReminderDelay(value)).toThrow();
    }
  });

  it('accepts a one-minute reminder despite normal command processing delay', async () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-09-29T01:00:00Z'));
      const remindAt = new Date(Date.now() + 60_000);
      vi.setSystemTime(new Date('2026-09-29T01:00:00.250Z'));
      vi.spyOn(ReminderModel, 'create').mockResolvedValue({ status: 'pending' } as never);
      await expect(ReminderService.createReminder({ userId: 'u', guildId: 'g', message: 'Test', remindAt }))
        .resolves.toMatchObject({ status: 'pending' });
    } finally {
      vi.useRealTimers();
    }
  });

  it('rejects an eleventh pending slot after database duplicate conflicts', async () => {
    const create = vi.spyOn(ReminderModel, 'create').mockRejectedValue({ code: 11000 });
    await expect(ReminderService.createReminder({
      userId: 'user-1', guildId: 'guild-1', message: 'One more',
      remindAt: new Date(Date.now() + 120_000)
    })).rejects.toThrow('10 lời nhắc');
    expect(create).toHaveBeenCalledTimes(10);
  });

  it('marks a delivered DM completed after send and never fetches a channel', async () => {
    vi.spyOn(ReminderModel, 'findOneAndUpdate').mockResolvedValueOnce(due as never).mockResolvedValueOnce(null);
    const update = vi.spyOn(ReminderModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    const send = vi.fn().mockResolvedValue({ id: 'discord-msg' });
    const client = { users: { fetch: vi.fn().mockResolvedValue({ send }) }, channels: { fetch: vi.fn() } } as never;

    expect(await ReminderService.pollReminders(client)).toBe(1);
    expect(send).toHaveBeenCalledWith(expect.stringContaining('Họp team'));
    expect(update).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      $set: expect.objectContaining({ status: 'completed' })
    }));
    const set = (update.mock.calls[0][1] as { $set: { deleteAt: Date } }).$set;
    expect(set.deleteAt.getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
    expect(set.deleteAt.getTime()).toBeLessThanOrEqual(Date.now() + 7 * 86_400_000);
    expect((client as { channels: { fetch: ReturnType<typeof vi.fn> } }).channels.fetch).not.toHaveBeenCalled();
  });

  it('records a blocked DM as failed without publishing or logging its contents', async () => {
    vi.spyOn(ReminderModel, 'findOneAndUpdate').mockResolvedValueOnce(due as never).mockResolvedValueOnce(null);
    const update = vi.spyOn(ReminderModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const client = {
      users: { fetch: vi.fn().mockResolvedValue({ send: vi.fn().mockRejectedValue(new Error('DM closed')) }) },
      channels: { fetch: vi.fn() }
    } as never;

    expect(await ReminderService.pollReminders(client)).toBe(1);
    expect(update).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({
      $set: expect.objectContaining({ status: 'failed' })
    }));
    expect((client as { channels: { fetch: ReturnType<typeof vi.fn> } }).channels.fetch).not.toHaveBeenCalled();
    expect(warn.mock.calls.flat().join(' ')).not.toContain('Họp team');
  });

  it('claims due work once when polling overlaps', async () => {
    const claim = vi.spyOn(ReminderModel, 'findOneAndUpdate').mockResolvedValueOnce(due as never).mockResolvedValue(null);
    vi.spyOn(ReminderModel, 'updateOne').mockResolvedValue({ modifiedCount: 1 } as never);
    const send = vi.fn().mockResolvedValue({ id: 'one' });
    const client = { users: { fetch: vi.fn().mockResolvedValue({ send }) } } as never;

    await Promise.all([ReminderService.pollReminders(client), ReminderService.pollReminders(client)]);
    expect(send).toHaveBeenCalledTimes(1);
    expect(claim).toHaveBeenCalled();
  });

  it('never reclaims a sending DM after its lease age to avoid duplicate delivery', async () => {
    const claim = vi.spyOn(ReminderModel, 'findOneAndUpdate').mockResolvedValue(null);
    await ReminderService.pollReminders({ users: { fetch: vi.fn() } } as never);
    expect(JSON.stringify(claim.mock.calls[0][0])).not.toContain('sending');
    expect(ReminderModel.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'sending' }),
      expect.objectContaining({ $set: expect.objectContaining({ status: 'failed' }) })
    );
  });
});
