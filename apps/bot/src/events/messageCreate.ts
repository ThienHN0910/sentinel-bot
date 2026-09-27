import { Message } from 'discord.js';
import { AnalyticsService } from '../services/analytics/AnalyticsService.js';

/**
 * messageCreate event handler.
 * Delegates to AnalyticsService to track XP, word stats, and mention graphs.
 */
export async function onMessageCreate(message: Message): Promise<void> {
  await AnalyticsService.handleMessage(message);
}
