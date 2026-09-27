import { describe, expect, it, vi } from 'vitest';
import { ActivityBucketModel } from '../src/models/ActivityBucket';
import { recordActivity } from '../src/services/analytics/activity';

describe('recordActivity', () => {
  it('increments the matching UTC hour for a real guild event', async () => {
    const update = vi.spyOn(ActivityBucketModel, 'updateOne').mockResolvedValue({} as any);
    await recordActivity('guild-1', 'messages', new Date('2026-09-27T08:45:12.000Z'));
    expect(update).toHaveBeenCalledWith(
      { guildId: 'guild-1', hour: new Date('2026-09-27T08:00:00.000Z') },
      { $inc: { messages: 1 } },
      { upsert: true }
    );
  });
});
