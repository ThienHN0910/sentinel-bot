import { Schema, model, Document } from 'mongoose';
import { IWheelSession } from '@sentinel/shared';

export interface WheelSessionDocument extends IWheelSession, Document {}

const WheelSessionSchema = new Schema<WheelSessionDocument>({
  sessionId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  createdBy: { type: String, required: true },
  title: { type: String, default: 'Vòng quay may mắn' },
  items: [{
    id: { type: String, required: true },
    label: { type: String, required: true },
    color: { type: String, required: true },
    weight: { type: Number, default: 1 }
  }],
  winner: { type: String },
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: '24h' }
});

export const WheelSessionModel = model<WheelSessionDocument>('WheelSession', WheelSessionSchema);
