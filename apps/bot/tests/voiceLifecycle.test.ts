import { beforeEach, describe, expect, it, vi } from 'vitest';
import mongoose from 'mongoose';
import { VoiceSessionModel } from '../src/models/VoiceSession';
import { UserStatModel } from '../src/models/UserStat';
import { ActivityBucketModel } from '../src/models/ActivityBucket';
import { GuildConfigModel } from '../src/models/GuildConfig';
import { VoiceService, pendingVoiceEvents, retryPendingVoiceEvents } from '../src/services/voice/VoiceService';

const start = new Date('2026-09-27T11:50:00.000Z');
const end = new Date('2026-09-27T12:00:00.000Z');

describe('durable voice lifecycle', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    pendingVoiceEvents.clear();
    vi.spyOn(ActivityBucketModel, 'updateOne').mockResolvedValue({} as any);
    vi.spyOn(GuildConfigModel, 'findOne').mockResolvedValue(null);
  });

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

  it('retries a failed join with the original observed timestamp', async () => {
    const observedAt = new Date('2026-09-27T12:00:00Z');
    vi.spyOn(VoiceSessionModel, 'findOne').mockResolvedValue(null);
    const startSession = vi.spyOn(VoiceService, 'startSession')
      .mockRejectedValueOnce(new Error('temporary outage'))
      .mockResolvedValue(undefined);
    const oldState = { id: 'u1', channelId: null, guild: { id: 'g1' } } as any;
    const newState = { id: 'u1', channelId: 'c1', sessionId: 's1', guild: { id: 'g1' }, member: { user: { bot: false } } } as any;
    await VoiceService.handleVoiceStateUpdate(oldState, newState, observedAt);
    expect(pendingVoiceEvents.get('g1:u1')).toHaveLength(1);
    await retryPendingVoiceEvents();
    expect(startSession).toHaveBeenNthCalledWith(2, 'g1', 'u1', 'c1', 's1', observedAt);
    expect(pendingVoiceEvents.has('g1:u1')).toBe(false);
  });

  it('settles a previous Discord connection before starting a different session', async () => {
    const lastObservedAt = new Date('2026-09-27T11:50:00Z');
    const joinedAt = new Date('2026-09-27T12:00:00Z');
    vi.spyOn(VoiceSessionModel, 'findOne').mockResolvedValue({ sessionId: 'old', lastObservedAt } as any);
    const order: string[] = [];
    vi.spyOn(VoiceService, 'settleSession').mockImplementation(async () => { order.push('settle'); });
    vi.spyOn(VoiceService, 'startSession').mockImplementation(async () => { order.push('start'); });
    await VoiceService.handleVoiceStateUpdate(
      { id: 'u1', channelId: null, guild: { id: 'g1' } } as any,
      { id: 'u1', channelId: 'c1', sessionId: 'new', guild: { id: 'g1' }, member: { user: { bot: false } } } as any,
      joinedAt
    );
    expect(order).toEqual(['settle', 'start']);
    expect(VoiceService.settleSession).toHaveBeenCalledWith('g1', 'u1', lastObservedAt);
  });

  it('credits a queued leave only through its observed time', async () => {
    let release!: () => void;
    vi.spyOn(VoiceSessionModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(VoiceService, 'startSession').mockImplementation(() => new Promise<void>((resolve) => { release = resolve; }));
    const settle = vi.spyOn(VoiceService, 'settleSession').mockResolvedValue(undefined);
    const join = VoiceService.handleVoiceStateUpdate(
      { id: 'u1', channelId: null, guild: { id: 'g1' } } as any,
      { id: 'u1', channelId: 'c1', sessionId: 's1', guild: { id: 'g1' }, member: { user: { bot: false } } } as any,
      new Date('2026-09-27T12:00:00Z')
    );
    await vi.waitFor(() => expect(release).toBeTypeOf('function'));
    const leftAt = new Date('2026-09-27T12:10:00Z');
    const leave = VoiceService.handleVoiceStateUpdate(
      { id: 'u1', channelId: 'c1', guild: { id: 'g1' }, member: { user: { bot: false } } } as any,
      { id: 'u1', channelId: null, guild: { id: 'g1' }, member: { user: { bot: false } } } as any,
      leftAt
    );
    release();
    await Promise.all([join, leave]);
    expect(settle).toHaveBeenCalledWith('g1', 'u1', leftAt, expect.any(Object));
  });
});
