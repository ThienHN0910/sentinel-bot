import { Schema, model, type Document } from 'mongoose';
import type { GameState } from '@sentinel/shared';

export interface GameSessionDocument extends GameState, Document {
  activeKey?: string;
}

const GameSessionSchema = new Schema<GameSessionDocument>({
  sessionId: { type: String, required: true },
  guildId: { type: String, required: true },
  kind: { type: String, enum: ['tictactoe', 'rps'], required: true },
  creatorId: { type: String, required: true },
  opponentId: { type: String, default: null },
  phase: { type: String, enum: ['waiting', 'active', 'finished'], required: true },
  expiresAt: { type: Date, required: true },
  deleteAt: { type: Date, required: true },
  version: { type: Number, default: 0 },
  board: { type: [String], default: undefined },
  turnId: String,
  choices: { type: Schema.Types.Mixed, default: undefined },
  result: { type: Schema.Types.Mixed, default: undefined },
  channelId: String,
  messageId: String,
  activeKey: String
});

GameSessionSchema.index({ sessionId: 1 }, { unique: true });
GameSessionSchema.index({ activeKey: 1 }, { unique: true, sparse: true });
GameSessionSchema.index({ deleteAt: 1 }, { expireAfterSeconds: 0 });
GameSessionSchema.index({ guildId: 1, creatorId: 1, expiresAt: 1 });

export const GameSessionModel = model<GameSessionDocument>('GameSession', GameSessionSchema);
