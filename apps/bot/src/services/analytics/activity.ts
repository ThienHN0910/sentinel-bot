import { ActivityBucketModel } from '../../models/ActivityBucket';

export async function recordActivity(guildId: string, kind: 'messages' | 'voiceJoins', now = new Date()) {
  const hour = new Date(now);
  hour.setUTCMinutes(0, 0, 0);
  await ActivityBucketModel.updateOne(
    { guildId, hour },
    { $inc: { [kind]: 1 } },
    { upsert: true }
  );
}
