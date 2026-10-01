import { Schema, model, Document } from 'mongoose';
import { IPet, PetType } from '@sentinel/shared';

export interface PetDocument extends IPet, Document {}

const PetSchema = new Schema<PetDocument>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  petType: {
    type: String,
    required: true,
    enum: ['cat', 'dog', 'dragon', 'fox']
  },
  name: { type: String, required: true, maxlength: 32 },
  hunger: { type: Number, default: 80, min: 0, max: 100 },
  happiness: { type: Number, default: 80, min: 0, max: 100 },
  lastFedAt: { type: Date, default: Date.now },
  lastPlayedAt: { type: Date, default: Date.now },
  adoptedAt: { type: Date, default: Date.now },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

PetSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const PetModel = model<PetDocument>('Pet', PetSchema);
