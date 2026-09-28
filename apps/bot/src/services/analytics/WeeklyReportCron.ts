import cron from 'node-cron';
import { randomUUID } from 'node:crypto';
import { Client, EmbedBuilder, type TextChannel } from 'discord.js';
import { UserStatModel } from '../../models/UserStat';
import { GuildConfigModel } from '../../models/GuildConfig';
import { ReportDeliveryModel } from '../../models/ReportDelivery';

const REPORT_TIMEZONE = 'Asia/Ho_Chi_Minh';
const HOUR_MS = 60 * 60 * 1000;
const LEASE_MS = 15 * 60_000;
const RENEW_MS = 60_000;

function reportWindow(now: Date): { weekStart: string } | null {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: REPORT_TIMEZONE, weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
  }).formatToParts(now).map((part) => [part.type, part.value]));
  const hour = Number(parts.hour);
  const minute = Number(parts.minute);
  if (parts.weekday !== 'Mon' || hour < 9 || hour > 18 || (hour === 18 && minute > 0)) return null;
  return { weekStart: `${parts.year}-${parts.month}-${parts.day}` };
}

async function claimDelivery(guildId: string, weekStart: string, now: Date): Promise<string | null> {
  const leaseOwner = randomUUID();
  try {
    const record = await ReportDeliveryModel.findOneAndUpdate(
      { guildId, weekStart, status: { $ne: 'sent' }, $or: [
        { leaseUntil: { $lte: now } }, { leaseUntil: { $exists: false } }
      ] },
      { $setOnInsert: { guildId, weekStart }, $set: { status: 'pending', leaseUntil: new Date(now.getTime() + LEASE_MS), leaseOwner }, $inc: { attempts: 1 } },
      { upsert: true, new: true }
    );
    return record ? leaseOwner : null;
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 11000) return null;
    throw error;
  }
}

export async function generateWeeklySummary(client: Client, now = new Date()): Promise<void> {
  const window = reportWindow(now);
  if (!window) return;
  const guilds = await GuildConfigModel.find({ reportChannelId: { $exists: true, $nin: [null, ''] } });

  for (const config of guilds) {
    if (!config.reportChannelId) continue;
    const channel = await client.channels.fetch(config.reportChannelId).catch(() => null) as TextChannel | null;
    if (!channel || typeof channel.send !== 'function') continue;
    const leaseOwner = await claimDelivery(config.guildId, window.weekStart, now);
    if (!leaseOwner) continue;
    const ownerFilter = { guildId: config.guildId, weekStart: window.weekStart, status: 'pending', leaseOwner };
    const renewal = setInterval(() => {
      void ReportDeliveryModel.updateOne(ownerFilter, { $set: { leaseUntil: new Date(Date.now() + LEASE_MS) } })
        .catch((error) => console.error(`[WeeklyReport] Lease renewal failed for guild ${config.guildId}:`, error));
    }, RENEW_MS);
    renewal.unref();

    try {
      const [topVoice, topChat] = await Promise.all([
        UserStatModel.find({ guildId: config.guildId }).sort({ totalVoiceSeconds: -1 }).limit(3),
        UserStatModel.find({ guildId: config.guildId }).sort({ totalMessages: -1 }).limit(3)
      ]);
      const embed = new EmbedBuilder()
        .setTitle('📊 BÁO CÁO HOẠT ĐỘNG CỘNG DỒN - SENTINEL BOT')
        .setDescription(`Xếp hạng cộng dồn từ khi Sentinel bắt đầu ghi nhận, tính đến ${now.toISOString()}. Voice chỉ gồm thời gian đã lưu.`)
        .setColor(0x00f2fe)
        .addFields(
          { name: '🏆 Voice đã lưu', value: topVoice.map((user, index) => `${index + 1}. **${user.username}** - ${Math.floor(user.totalVoiceSeconds / 3600)} giờ`).join('\n') || 'Chưa có dữ liệu' },
          { name: '💬 Tin nhắn', value: topChat.map((user, index) => `${index + 1}. **${user.username}** - ${user.totalMessages} tin nhắn`).join('\n') || 'Chưa có dữ liệu' }
        )
        .setTimestamp(now);
      await channel.send({ embeds: [embed] });
      await ReportDeliveryModel.updateOne(ownerFilter, { $set: { status: 'sent', sentAt: now }, $unset: { leaseUntil: 1, leaseOwner: 1 } });
    } catch (error) {
      await ReportDeliveryModel.updateOne(
        ownerFilter,
        { $set: { leaseUntil: new Date(now.getTime() + HOUR_MS) }, $unset: { leaseOwner: 1 } }
      );
      console.error(`[WeeklyReport] Failed for guild ${config.guildId}:`, error);
    } finally {
      clearInterval(renewal);
    }
  }
}

export function scheduleWeeklyReports(client: Client): { stop(): void } {
  return cron.schedule('0 9-18 * * 1', () => {
    void generateWeeklySummary(client).catch((error) => console.error('[WeeklyReport] Scheduler failed:', error));
  }, { timezone: REPORT_TIMEZONE });
}
