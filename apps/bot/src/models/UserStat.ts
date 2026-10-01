import { Schema, model, Document } from 'mongoose';
import { IUserStat } from '@sentinel/shared';

export interface UserStatDocument extends IUserStat, Document {}

const UserStatSchema = new Schema<UserStatDocument>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  avatar: { type: String, default: '' },
  totalVoiceSeconds: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  totalImages: { type: Number, default: 0 },
  exp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  dneCoins: { type: Number, default: 0 },
  dailyStreak: { type: Number, default: 0 },
  lastDailyAt: { type: Date },
  repCount: { type: Number, default: 0 },
  repGivenToday: { type: Number, default: 0 },
  lastRepResetAt: { type: Date },
  lastGachaAt: { type: Date },
  gachaPity: { type: Number, default: 0 },
  mentionedUsers: { type: Map, of: Number, default: {} },
  updatedAt: { type: Date, default: Date.now }
});

UserStatSchema.index({ guildId: 1, userId: 1 }, { unique: true });
UserStatSchema.index({ guildId: 1, totalMessages: -1, userId: 1 });
UserStatSchema.index({ guildId: 1, totalVoiceSeconds: -1, userId: 1 });
UserStatSchema.index({ guildId: 1, exp: -1, userId: 1 });

export const UserStatModel = model<UserStatDocument>('UserStat', UserStatSchema);
