import { describe, expect, it } from 'vitest';
import { formatVoiceDuration, toActivitySeries, toCloudWords, toPodium } from '../src/utils/dashboardData';

describe('dashboard API mapping', () => {
  it('uses API counts and usernames without demo values', () => {
    expect(toPodium([{ rank: 1, username: 'Actual member', avatar: '', score: 17 }])).toEqual([
      { rank: 1, username: 'Actual member', avatar: '', score: 17 }
    ]);
    expect(toCloudWords([{ text: 'actual', count: 20 }, { text: 'low', count: 2 }])).toEqual([
      { text: 'actual', weight: 10, color: '#00f2fe' },
      { text: 'low', weight: 1, color: '#7f00ff' }
    ]);
  });
});

describe('voice display values', () => {
  it.each([
    [0, '0 phút'], [59, '0 phút'], [60, '1 phút'], [3660, '1 giờ 1 phút']
  ])('formats %i seconds as %s', (seconds, expected) => {
    expect(formatVoiceDuration(seconds)).toBe(expected);
  });

  it('keeps chat messages and voice joins as separate activity series', () => {
    const activity = { days: ['2026-09-27'], messagesMatrix: [[3]], voiceJoinsMatrix: [[2]] };
    expect(toActivitySeries(activity)).toEqual({ messages: [[3]], voiceJoins: [[2]] });
  });
});
