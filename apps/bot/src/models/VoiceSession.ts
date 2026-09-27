import { Schema, model } from 'mongoose';

export interface VoiceSession {
  guildId: string;
  userId: string;
  channelId: string;
  sessionId?: string | null;
  startedAt: Date;
  lastObservedAt: Date;
}

const VoiceSessionSchema = new Schema<VoiceSession>({
  guildId: { type: String, required: true },
  userId: { type: String, required: true },
  channelId: { type: String, required: true },
  sessionId: { type: String, default: null },
  startedAt: { type: Date, required: true },
  lastObservedAt: { type: Date, required: true }
});

VoiceSessionSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const VoiceSessionModel = model<VoiceSession>('VoiceSession', VoiceSessionSchema);
