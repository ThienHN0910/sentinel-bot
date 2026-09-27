import { Schema, model, Document } from 'mongoose';
import { IReminder } from '@sentinel/shared';

export interface ReminderDocument extends Omit<IReminder, 'id'>, Document {}

const ReminderSchema = new Schema<ReminderDocument>({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  message: { type: String, required: true },
  remindAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

ReminderSchema.index({ remindAt: 1, status: 1 });

export const ReminderModel = model<ReminderDocument>('Reminder', ReminderSchema);
