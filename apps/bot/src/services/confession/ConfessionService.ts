import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client } from 'discord.js';
import { ConfessionModel } from '../../models/Confession';
import { GuildConfigModel } from '../../models/GuildConfig';

export class ConfessionService {
  private static readonly RATE_LIMIT_DURATION_MS = 5 * 60 * 1000;
  private static userCooldowns = new Map<string, number>();
  private static sweepInterval: NodeJS.Timeout | null = null;

  public static startSweepInterval(): void {
    if (this.sweepInterval) return;
    this.sweepInterval = setInterval(() => {
      this.sweepExpiredCooldowns();
    }, 5 * 60 * 1000);
    this.sweepInterval.unref?.();
  }

  public static stopSweepInterval(): void {
    if (this.sweepInterval) {
      clearInterval(this.sweepInterval);
      this.sweepInterval = null;
    }
  }

  public static sweepExpiredCooldowns(now: number = Date.now()): void {
    for (const [userId, lastTimestamp] of this.userCooldowns.entries()) {
      if (now - lastTimestamp >= this.RATE_LIMIT_DURATION_MS) {
        this.userCooldowns.delete(userId);
      }
    }
  }

  public static clearRateLimits(): void {
    this.userCooldowns.clear();
  }

  public static checkRateLimit(
    userId: string,
    now: Date = new Date()
  ): { allowed: boolean; retryAfterSeconds: number } {
    const lastTimestamp = this.userCooldowns.get(userId);
    if (lastTimestamp !== undefined) {
      const elapsed = now.getTime() - lastTimestamp;
      if (elapsed < this.RATE_LIMIT_DURATION_MS) {
        const remainingMs = this.RATE_LIMIT_DURATION_MS - elapsed;
        return {
          allowed: false,
          retryAfterSeconds: Math.ceil(remainingMs / 1000)
        };
      }
    }

    this.userCooldowns.set(userId, now.getTime());
    return {
      allowed: true,
      retryAfterSeconds: 0
    };
  }

  public static async getNextConfessionNumber(guildId: string): Promise<number> {
    const latest = await ConfessionModel.findOne({ guildId })
      .sort({ confessionNumber: -1 })
      .select({ confessionNumber: 1 });
    return latest ? latest.confessionNumber + 1 : 1;
  }

  public static async postConfession(params: {
    guildId: string;
    content: string;
    client: Client;
  }): Promise<{ confessionNumber: number; messageId: string }> {
    const { guildId, content, client } = params;

    const config = await GuildConfigModel.findOne({ guildId });
    if (!config || !config.confessionChannelId) {
      throw new Error('Confession channel is not configured');
    }

    const channel = await client.channels.fetch(config.confessionChannelId);
    if (!channel || !channel.isTextBased() || !('send' in channel)) {
      throw new Error('Confession channel not found or invalid');
    }

    let confessionNumber = await this.getNextConfessionNumber(guildId);

    const buildPayload = (num: number) => {
      const embed = new EmbedBuilder()
        .setTitle(`📬 CONFESSION #${num}`)
        .setDescription(content)
        .setColor(0x5865f2);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`confess:react:heart:${num}`)
          .setLabel('Yêu thích (0)')
          .setEmoji('❤️')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`confess:react:laugh:${num}`)
          .setLabel('Haha (0)')
          .setEmoji('😂')
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId(`confess:react:discuss:${num}`)
          .setLabel('Thảo luận')
          .setEmoji('💬')
          .setStyle(ButtonStyle.Secondary)
      );

      return { embed, row };
    };

    const initial = buildPayload(confessionNumber);

    const message = await (channel as any).send({
      embeds: [initial.embed],
      components: [initial.row]
    });

    const maxAttempts = 3;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await ConfessionModel.create({
          guildId,
          confessionNumber,
          content,
          messageId: message.id,
          createdAt: new Date()
        });

        return {
          confessionNumber,
          messageId: message.id
        };
      } catch (err: any) {
        const isDuplicateKey =
          err?.code === 11000 ||
          String(err?.message || '').includes('11000') ||
          String(err?.message || '').includes('E11000');

        if (isDuplicateKey && attempt < maxAttempts) {
          confessionNumber = await this.getNextConfessionNumber(guildId);
          const updated = buildPayload(confessionNumber);
          if (message.edit && typeof message.edit === 'function') {
            await message
              .edit({
                embeds: [updated.embed],
                components: [updated.row]
              })
              .catch(() => null);
          }
          continue;
        }

        throw err;
      }
    }

    return {
      confessionNumber,
      messageId: message.id
    };
  }

  public static async deleteConfession(params: {
    guildId: string;
    confessionNumber: number;
    client: Client;
  }): Promise<boolean> {
    const { guildId, confessionNumber, client } = params;

    const confession = await ConfessionModel.findOne({ guildId, confessionNumber });
    if (!confession) {
      return false;
    }

    try {
      const config = await GuildConfigModel.findOne({ guildId });
      if (config?.confessionChannelId) {
        const channel = await client.channels.fetch(config.confessionChannelId);
        if (channel && channel.isTextBased() && 'messages' in channel) {
          const message = await (channel as any).messages.fetch(confession.messageId);
          if (message) {
            await message.delete();
          }
        }
      }
    } catch {
      // Message may already be deleted from Discord
    }

    await ConfessionModel.deleteOne({ guildId, confessionNumber });
    return true;
  }
}

// Start periodic rate-limit cleanup
ConfessionService.startSweepInterval();

