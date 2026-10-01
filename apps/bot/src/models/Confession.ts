import { Document, Schema, model } from 'mongoose';
import { IConfession } from '@sentinel/shared';

export interface ConfessionDocument extends IConfession, Document {}

const ConfessionSchema = new Schema<ConfessionDocument>({
  guildId: { type: String, required: true, index: true },
  confessionNumber: { type: Number, required: true },
  content: { type: String, required: true },
  messageId: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

ConfessionSchema.index({ guildId: 1, confessionNumber: 1 }, { unique: true });

export const ConfessionModel = model<ConfessionDocument>('Confession', ConfessionSchema);
