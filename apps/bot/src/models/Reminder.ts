import { Schema, model, Document } from 'mongoose';
import { IReminder } from '@sentinel/shared';

export interface ReminderDocument extends Omit<IReminder, 'id'>, Document {}

const ReminderSchema = new Schema<ReminderDocument>({
  publicId: { type: String, required: true, unique: true },
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  message: { type: String, required: true },
  remindAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'sending', 'completed', 'failed', 'cancelled'], default: 'pending' },
  slot: { type: Number, required: true, min: 0, max: 9 },
  attempts: { type: Number, default: 0 },
  claimedAt: Date,
  deleteAt: Date,
  createdAt: { type: Date, default: Date.now }
});

ReminderSchema.index({ status: 1, remindAt: 1 });
ReminderSchema.index({ userId: 1, slot: 1 }, {
  unique: true,
  partialFilterExpression: { status: { $in: ['pending', 'sending'] } }
});
ReminderSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });

export const ReminderModel = model<ReminderDocument>('Reminder', ReminderSchema);
