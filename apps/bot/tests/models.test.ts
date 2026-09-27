import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import {
  UserStatModel,
  GuildConfigModel,
  WordStatModel,
  ReminderModel,
  WheelSessionModel,
  connectDatabase
} from '../src/models';

describe('MongoDB Mongoose Models Validation', () => {
  it('validates UserStat required fields and default values', () => {
    const user = new UserStatModel({
      guildId: '123456',
      userId: '78910',
      username: 'TestUser',
      avatar: 'https://example.com/avatar.png'
    });

    expect(user.totalVoiceSeconds).toBe(0);
    expect(user.totalMessages).toBe(0);
    expect(user.exp).toBe(0);
    expect(user.level).toBe(1);
    expect(user.dneCoins).toBe(0);
    expect(user.dailyStreak).toBe(0);
  });

  it('validates GuildConfig defaults', () => {
    const config = new GuildConfigModel({
      guildId: '123456',
      name: 'Sentinel Guild'
    });

    expect(config.welcomeVoiceTts).toBe(true);
    expect(config.welcomeMessage).toContain('Chào mừng');
  });

  it('validates WordStat defaults', () => {
    const wordStat = new WordStatModel({
      guildId: '123456',
      word: 'hello'
    });

    expect(wordStat.count).toBe(1);
    expect(wordStat.lastSeenAt).toBeInstanceOf(Date);
  });

  it('validates Reminder defaults', () => {
    const reminder = new ReminderModel({
      userId: '78910',
      guildId: '123456',
      channelId: '111222',
      message: 'Test reminder',
      remindAt: new Date(Date.now() + 60000)
    });

    expect(reminder.status).toBe('pending');
    expect(reminder.createdAt).toBeInstanceOf(Date);
  });

  it('validates WheelSession defaults', () => {
    const session = new WheelSessionModel({
      sessionId: 'session-123',
      guildId: '123456',
      createdBy: '78910'
    });

    expect(session.title).toBe('Vòng quay may mắn');
    expect(session.isCompleted).toBe(false);
    expect(session.createdAt).toBeInstanceOf(Date);
  });

  it('verifies connectDatabase is a callable function', () => {
    expect(typeof connectDatabase).toBe('function');
  });
});
