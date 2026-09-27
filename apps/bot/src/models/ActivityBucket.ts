import { Schema, model } from 'mongoose';

export interface ActivityBucket {
  guildId: string;
  hour: Date;
  messages: number;
  voiceJoins: number;
}

const ActivityBucketSchema = new Schema<ActivityBucket>({
  guildId: { type: String, required: true },
  hour: { type: Date, required: true },
  messages: { type: Number, default: 0 },
  voiceJoins: { type: Number, default: 0 }
});

ActivityBucketSchema.index({ guildId: 1, hour: 1 }, { unique: true });
ActivityBucketSchema.index({ hour: 1 }, { expireAfterSeconds: 8 * 24 * 60 * 60 });

export const ActivityBucketModel = model<ActivityBucket>('ActivityBucket', ActivityBucketSchema);
