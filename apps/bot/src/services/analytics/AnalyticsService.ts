import { Message } from 'discord.js';
import { UserStatModel } from '../../models/UserStat';
import { WordStatModel } from '../../models/WordStat';
import { tokenizeMessage, extractMentions } from './textParser';

const chatCooldowns = new Map<string, number>();

export class AnalyticsService {
  public static readonly chatCooldowns = chatCooldowns;

  public static async handleMessage(message: Message) {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const imageCount = typeof (message.attachments as any)?.filter === 'function'
      ? (message.attachments as any).filter((att: any) => att.contentType?.startsWith('image/')).size
      : Array.from(message.attachments?.values() || []).filter((att: any) => att.contentType?.startsWith('image/')).length;

    // EXP Cooldown check (60s)
    const cooldownKey = `${guildId}:${userId}`;
    const now = Date.now();
    const lastAwarded = chatCooldowns.get(cooldownKey) || 0;
    const awardExp = now - lastAwarded >= 60000 ? Math.floor(Math.random() * 10) + 15 : 0;
    if (awardExp > 0) chatCooldowns.set(cooldownKey, now);

    // Extract mentions
    const mentions = extractMentions(message.content);
    const mentionIncObj: Record<string, number> = {};
    for (const mId of mentions) {
      mentionIncObj[`mentionedUsers.${mId}`] = (mentionIncObj[`mentionedUsers.${mId}`] || 0) + 1;
    }

    // Upsert User Stat
    await UserStatModel.findOneAndUpdate(
      { guildId, userId },
      {
        $inc: {
          totalMessages: 1,
          totalImages: imageCount,
          exp: awardExp,
          ...mentionIncObj
        },
        $set: {
          username: message.author.username,
          avatar: message.author.displayAvatarURL(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    // Tokenize and batch update words
    const tokens = tokenizeMessage(message.content);
    if (tokens.length > 0) {
      const bulkOps = tokens.map((word) => ({
        updateOne: {
          filter: { guildId, word },
          update: { $inc: { count: 1 }, $set: { lastSeenAt: new Date() } },
          upsert: true
        }
      }));
      await WordStatModel.bulkWrite(bulkOps);
    }
  }
}
