import cron from 'node-cron';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { UserStatModel } from '../../models/UserStat';
import { WordStatModel } from '../../models/WordStat';
import { GuildConfigModel } from '../../models/GuildConfig';

export async function generateWeeklySummary(client: Client): Promise<void> {
  const guilds = await GuildConfigModel.find({ reportChannelId: { $exists: true } });

  for (const g of guilds) {
    if (!g.reportChannelId) continue;
    const channel = (await client.channels.fetch(g.reportChannelId).catch(() => null)) as TextChannel | null;
    if (!channel) continue;

    const [topVoice, topChat, topWords] = await Promise.all([
      UserStatModel.find({ guildId: g.guildId }).sort({ totalVoiceSeconds: -1 }).limit(3),
      UserStatModel.find({ guildId: g.guildId }).sort({ totalMessages: -1 }).limit(3),
      WordStatModel.find({ guildId: g.guildId }).sort({ count: -1 }).limit(5)
    ]);

    const embed = new EmbedBuilder()
      .setTitle('📊 BÁO CÁO HOẠT ĐỘNG TUẦN - SENTINEL BOT')
      .setColor(0x00f2fe)
      .addFields(
        {
          name: '🏆 Top Voice Champions',
          value: topVoice.map((u, i) => `${i + 1}. **${u.username}** - ${Math.round(u.totalVoiceSeconds / 3600)}h`).join('\n') || 'Chưa có dữ liệu'
        },
        {
          name: '💬 Top Chiến Thần Chat',
          value: topChat.map((u, i) => `${i + 1}. **${u.username}** - ${u.totalMessages} tin nhắn`).join('\n') || 'Chưa có dữ liệu'
        },
        {
          name: '🔥 Từ Khóa Hot Nhất Tuần',
          value: topWords.map((w) => `\`${w.word}\` (${w.count})`).join(', ') || 'Chưa có dữ liệu'
        }
      )
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  }
}

export function scheduleWeeklyReports(client: Client) {
  // Every Monday at 00:00:00
  return cron.schedule('0 0 * * 1', async () => {
    try {
      await generateWeeklySummary(client);
    } catch (err) {
      console.error('Failed to run weekly report:', err);
    }
  });
}
