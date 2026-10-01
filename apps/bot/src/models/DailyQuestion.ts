import { Schema, model, Document } from 'mongoose';
import { IDailyQuestion } from '@sentinel/shared';

export interface DailyQuestionDocument extends IDailyQuestion, Document {}

const DailyQuestionSchema = new Schema<DailyQuestionDocument>({
  guildId: { type: String, required: true, index: true },
  date: { type: String, required: true, index: true },
  type: { type: String, required: true, enum: ['wyr', 'this_that', 'trivia'] },
  question: { type: String, required: true },
  options: [
    {
      key: { type: String, required: true },
      label: { type: String, required: true },
      votes: { type: [String], default: [] }
    }
  ],
  correctAnswerKey: { type: String, default: null },
  rewardedUserIds: { type: [String], default: [] },
  messageId: { type: String, required: true },
  channelId: { type: String, required: true }
});

DailyQuestionSchema.index({ guildId: 1, date: 1 }, { unique: true });

export const DailyQuestionModel = model<DailyQuestionDocument>('DailyQuestion', DailyQuestionSchema);
