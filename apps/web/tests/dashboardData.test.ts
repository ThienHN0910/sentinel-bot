import { describe, expect, it } from 'vitest';
import { toCloudWords, toPodium } from '../src/utils/dashboardData';

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
