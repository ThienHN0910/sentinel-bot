import { Schema, model, Document } from 'mongoose';
import { IBet, Wager } from '@sentinel/shared';

export interface BetDocument extends IBet, Document {}

const WagerSchema = new Schema<Wager>(
  {
    userId: { type: String, required: true },
    username: { type: String, required: true },
    option: { type: String, required: true },
    amount: { type: Number, required: true },
    createdAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const BetSchema = new Schema<BetDocument>({
  betId: { type: String, required: true, unique: true, index: true },
  guildId: { type: String, required: true, index: true },
  kind: { type: String, enum: ['p2p', 'pool'], required: true },
  creatorId: { type: String, required: true, index: true },
  creatorUsername: { type: String, required: true },
  opponentId: { type: String },
  opponentUsername: { type: String },
  title: { type: String, required: true },
  options: { type: [String], required: true },
  wagers: { type: [WagerSchema], default: [] },
  status: {
    type: String,
    enum: ['open', 'active', 'locked', 'resolved', 'cancelled'],
    default: 'open',
    index: true
  },
  winnerOption: { type: String },
  winnerUserId: { type: String },
  totalPool: { type: Number, required: true, default: 0 },
  expiresAt: { type: Date, required: true, index: true },
  resolvedAt: { type: Date },
  createdAt: { type: Date, default: Date.now }
});

BetSchema.index({ guildId: 1, status: 1 });
BetSchema.index({ guildId: 1, creatorId: 1 });

export const BetModel = model<BetDocument>('Bet', BetSchema);
