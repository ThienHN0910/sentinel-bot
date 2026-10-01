import { Schema, model, Document } from 'mongoose';
import { IGuildConfig } from '@sentinel/shared';

export interface GuildConfigDocument extends IGuildConfig, Document {}

const GuildConfigSchema = new Schema<GuildConfigDocument>({
  guildId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  welcomeVoiceTts: { type: Boolean, default: true },
  welcomeMessage: { type: String, default: 'Chào mừng {user} đã tham gia phòng thoại!' },
  reportChannelId: { type: String },
  confessionChannelId: { type: String, default: null },
  qotdChannelId: { type: String, default: null },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const GuildConfigModel = model<GuildConfigDocument>('GuildConfig', GuildConfigSchema);
