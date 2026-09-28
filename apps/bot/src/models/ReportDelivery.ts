import { model, Schema } from 'mongoose';

export interface ReportDelivery {
  guildId: string;
  weekStart: string;
  status: 'pending' | 'sent';
  leaseUntil?: Date;
  leaseOwner?: string;
  sentAt?: Date;
  attempts: number;
}

const ReportDeliverySchema = new Schema<ReportDelivery>({
  guildId: { type: String, required: true },
  weekStart: { type: String, required: true },
  status: { type: String, required: true, enum: ['pending', 'sent'] },
  leaseUntil: { type: Date },
  leaseOwner: { type: String },
  sentAt: { type: Date },
  attempts: { type: Number, default: 0 }
});
ReportDeliverySchema.index({ guildId: 1, weekStart: 1 }, { unique: true });

export const ReportDeliveryModel = model<ReportDelivery>('ReportDelivery', ReportDeliverySchema);
