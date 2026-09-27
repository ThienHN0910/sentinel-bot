import { beforeEach, describe, expect, it, vi } from 'vitest';
import { VoiceSessionModel } from '../src/models/VoiceSession';
import { VoiceService, runVoiceKeyed } from '../src/services/voice/VoiceService';
import { reconcileVoiceSessions } from '../src/services/voice/voiceReconciliation';

const now = new Date('2026-09-27T12:00:00.000Z');
const previous = new Date('2026-09-27T11:50:00.000Z');

function clientWith(states: Array<{ id: string; sessionId: string; channelId: string }>) {
  const cache = new Map(states.map((state) => [state.id, {
    ...state,
    member: { user: { bot: false } },
    guild: { id: 'g1' }
  }]));
  const guild = { id: 'g1', voiceStates: { cache } };
  return { guilds: { cache: new Map([['g1', guild]]) } } as any;
}

describe('startup voice reconciliation', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('preserves a still connected Discord session', async () => {
    vi.spyOn(VoiceSessionModel, 'find').mockResolvedValue([{ guildId: 'g1', userId: 'u1', channelId: 'c1', sessionId: 's1', startedAt: previous, lastObservedAt: previous }] as any);
    vi.spyOn(VoiceSessionModel, 'findOne').mockResolvedValue({ guildId: 'g1', userId: 'u1', channelId: 'c1', sessionId: 's1', startedAt: previous, lastObservedAt: previous } as any);
    const start = vi.spyOn(VoiceService, 'startSession').mockResolvedValue(undefined);
    const settle = vi.spyOn(VoiceService, 'settleSession').mockResolvedValue(undefined);
    await reconcileVoiceSessions(clientWith([{ id: 'u1', sessionId: 's1', channelId: 'c1' }]), now);
    expect(start).not.toHaveBeenCalled();
    expect(settle).not.toHaveBeenCalled();
  });

  it('closes a missing member only through last observation', async () => {
    vi.spyOn(VoiceSessionModel, 'find').mockResolvedValue([{ guildId: 'g1', userId: 'u1', channelId: 'c1', sessionId: 's1', startedAt: previous, lastObservedAt: previous }] as any);
    vi.spyOn(VoiceSessionModel, 'findOne').mockResolvedValue({ guildId: 'g1', userId: 'u1', channelId: 'c1', sessionId: 's1', startedAt: previous, lastObservedAt: previous } as any);
    const settle = vi.spyOn(VoiceService, 'settleSession').mockResolvedValue(undefined);
    await reconcileVoiceSessions(clientWith([]), now);
    expect(settle).toHaveBeenCalledWith('g1', 'u1', previous);
  });

  it('starts observing an already connected member at startup', async () => {
    vi.spyOn(VoiceSessionModel, 'find').mockResolvedValue([] as any);
    vi.spyOn(VoiceSessionModel, 'findOne').mockResolvedValue(null);
    const start = vi.spyOn(VoiceService, 'startSession').mockResolvedValue(undefined);
    await reconcileVoiceSessions(clientWith([{ id: 'u1', sessionId: 's1', channelId: 'c1' }]), now);
    expect(start).toHaveBeenCalledWith('g1', 'u1', 'c1', 's1', now);
  });

  it('separates a new Discord session from one lost during downtime', async () => {
    vi.spyOn(VoiceSessionModel, 'find').mockResolvedValue([{ guildId: 'g1', userId: 'u1', channelId: 'c1', sessionId: 'old', startedAt: previous, lastObservedAt: previous }] as any);
    vi.spyOn(VoiceSessionModel, 'findOne').mockResolvedValue({ guildId: 'g1', userId: 'u1', channelId: 'c1', sessionId: 'old', startedAt: previous, lastObservedAt: previous } as any);
    const start = vi.spyOn(VoiceService, 'startSession').mockResolvedValue(undefined);
    const settle = vi.spyOn(VoiceService, 'settleSession').mockResolvedValue(undefined);
    await reconcileVoiceSessions(clientWith([{ id: 'u1', sessionId: 'new', channelId: 'c1' }]), now);
    expect(settle).toHaveBeenCalledWith('g1', 'u1', previous);
    expect(start).toHaveBeenCalledWith('g1', 'u1', 'c1', 'new', now);
  });

  it('serializes gateway and reconciliation work for one user', async () => {
    const order: string[] = [];
    let release!: () => void;
    const first = runVoiceKeyed('g1', 'u1', async () => {
      order.push('first-start');
      await new Promise<void>((resolve) => { release = resolve; });
      order.push('first-end');
    });
    const second = runVoiceKeyed('g1', 'u1', async () => { order.push('second'); });
    await Promise.resolve();
    expect(order).toEqual(['first-start']);
    release();
    await Promise.all([first, second]);
    expect(order).toEqual(['first-start', 'first-end', 'second']);
  });
});
