import { describe, expect, it } from 'vitest';
import { getActiveVoiceSeconds, getUserVoiceSeconds } from '../src/services/voice/voiceStats';
import { VoiceSessionModel } from '../src/models/VoiceSession';

describe('voice read math', () => {
  const now = new Date('2026-09-27T12:10:00.000Z');

  it('counts a current session in whole seconds', () => {
    expect(getActiveVoiceSeconds({ startedAt: new Date('2026-09-27T12:00:00.000Z') }, now)).toBe(600);
  });

  it('does not report negative duration for a future start', () => {
    expect(getActiveVoiceSeconds({ startedAt: new Date('2026-09-27T12:11:00.000Z') }, now)).toBe(0);
  });

  it('combines completed and active time without changing the completed value', () => {
    expect(getUserVoiceSeconds(300, { startedAt: new Date('2026-09-27T12:00:00.000Z') }, now)).toEqual({
      completedSeconds: 300,
      activeEstimatedSeconds: 600,
      totalEstimatedSeconds: 900
    });
  });
});

describe('VoiceSession model', () => {
  it('requires guild, user, channel, start, and last observation', () => {
    const invalid = new VoiceSessionModel({ guildId: 'g1' });
    const errors = invalid.validateSync()?.errors;
    expect(Object.keys(errors ?? {}).sort()).toEqual(['channelId', 'lastObservedAt', 'startedAt', 'userId']);
  });

  it('has a unique guild/user index', () => {
    expect(VoiceSessionModel.schema.indexes()).toEqual(expect.arrayContaining([
      [{ guildId: 1, userId: 1 }, expect.objectContaining({ unique: true })]
    ]));
  });
});
