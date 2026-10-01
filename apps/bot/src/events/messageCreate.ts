import { Message } from 'discord.js';
import { AnalyticsService } from '../services/analytics/AnalyticsService.js';
import { handleDirectMessageConfession } from '../commands/confess.js';

/**
 * messageCreate event handler.
 * Routes DM messages to Confession handler.
 * Delegates guild messages to AnalyticsService to track XP, word stats, and mention graphs.
 */
export async function onMessageCreate(message: Message): Promise<void> {
  if (message.author?.bot) return;

  if (!message.guild) {
    await handleDirectMessageConfession(message);
    return;
  }

  await AnalyticsService.handleMessage(message);
}
