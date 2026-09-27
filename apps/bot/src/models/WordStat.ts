import { Schema, model, Document } from 'mongoose';
import { IWordStat } from '@sentinel/shared';

export interface WordStatDocument extends IWordStat, Document {}

const WordStatSchema = new Schema<WordStatDocument>({
  guildId: { type: String, required: true, index: true },
  word: { type: String, required: true, index: true },
  count: { type: Number, default: 1 },
  lastSeenAt: { type: Date, default: Date.now, expires: '60d' }
});

WordStatSchema.index({ guildId: 1, word: 1 }, { unique: true });

export const WordStatModel = model<WordStatDocument>('WordStat', WordStatSchema);
