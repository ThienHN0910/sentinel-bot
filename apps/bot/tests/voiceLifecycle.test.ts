import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { VoiceSessionModel } from '../src/models/VoiceSession';
import { UserStatModel } from '../src/models/UserStat';
import { VoiceService } from '../src/services/voice/VoiceService';

const start = new Date('2026-09-27T11:50:00.000Z');
const end = new Date('2026-09-27T12:00:00.000Z');

describe('durable voice lifecycle', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('upserts the first join without resetting the start on duplicate joins', async () => {
    const write = vi.spyOn(VoiceSessionModel, 'findOneAndUpdate').mockResolvedValue({} as any);
    await VoiceService.startSession('g1', 'u1', 'c1', 's1', start);
    expect(write).toHaveBeenCalledWith(
      { guildId: 'g1', userId: 'u1' },
      expect.objectContaining({ $setOnInsert: expect.objectContaining({ startedAt: start }) }),
      expect.objectContaining({ upsert: true })
    );
  });

  it('settles completed seconds and rewards in one transaction', async () => {
    const tx = { withTransaction: async (callback: () => Promise<void>) => callback(), endSession: vi.fn() } as any;
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(tx);
    vi.spyOn(VoiceSessionModel, 'findOne').mockReturnValue({ session: async () => ({ guildId: 'g1', userId: 'u1', startedAt: start, lastObservedAt: end }) } as any);
    const credit = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);
    const remove = vi.spyOn(VoiceSessionModel, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as any);
    await VoiceService.settleSession('g1', 'u1', end);
    expect(credit).toHaveBeenCalledWith(
      { guildId: 'g1', userId: 'u1' },
      expect.objectContaining({ $inc: expect.objectContaining({ totalVoiceSeconds: 600, exp: 20, dneCoins: 10 }) }),
      expect.objectContaining({ upsert: true, session: tx })
    );
    expect(remove).toHaveBeenCalledWith({ guildId: 'g1', userId: 'u1' }, { session: tx });
    const update = credit.mock.calls[0][1] as any;
    expect(update.$set).not.toHaveProperty('username');
    expect(update.$setOnInsert.username).toBe('User');
  });

  it('retains a session if settlement transaction fails', async () => {
    const tx = { withTransaction: async (callback: () => Promise<void>) => callback(), endSession: vi.fn() } as any;
    vi.spyOn(mongoose, 'startSession').mockResolvedValue(tx);
    vi.spyOn(VoiceSessionModel, 'findOne').mockReturnValue({ session: async () => ({ guildId: 'g1', userId: 'u1', startedAt: start, lastObservedAt: end }) } as any);
    vi.spyOn(UserStatModel, 'findOneAndUpdate').mockRejectedValue(new Error('database unavailable'));
    const remove = vi.spyOn(VoiceSessionModel, 'deleteOne');
    await expect(VoiceService.settleSession('g1', 'u1', end)).rejects.toThrow('database unavailable');
    expect(remove).not.toHaveBeenCalled();
    expect(tx.endSession).toHaveBeenCalled();
  });
});
