import { ChannelType, PermissionFlagsBits, type Guild } from 'discord.js';
import type { GuildSettingsInput, GuildSettingsResponse } from '@sentinel/shared';
import { GuildConfigModel } from '../../models/GuildConfig';

export const DEFAULT_GREETING = 'Chào mừng {user} đã tham gia phòng thoại!';
const ALLOWED_FIELDS = new Set(['welcomeVoiceTts', 'welcomeMessage', 'reportChannelId']);

export class GuildSettingsError extends Error {
  constructor(message: string) { super(message); }
}

function writableChannels(guild: Guild): { id: string; name: string }[] {
  const bot = guild.members.me;
  if (!bot) return [];
  return [...guild.channels.cache.values()]
    .filter((channel) => channel.type === ChannelType.GuildText &&
      channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks]))
    .map((channel) => ({ id: channel.id, name: channel.name }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function responseFrom(guild: Guild, config: { welcomeVoiceTts?: boolean; welcomeMessage?: string; reportChannelId?: string } | null): GuildSettingsResponse {
  return {
    welcomeVoiceTts: config?.welcomeVoiceTts ?? true,
    welcomeMessage: config?.welcomeMessage ?? DEFAULT_GREETING,
    reportChannelId: config?.reportChannelId ?? null,
    channels: writableChannels(guild)
  };
}

export async function readGuildSettings(guild: Guild): Promise<GuildSettingsResponse> {
  const config = await GuildConfigModel.findOne({ guildId: guild.id }).lean();
  return responseFrom(guild, config);
}

export async function saveGuildSettings(guild: Guild, input: GuildSettingsInput): Promise<GuildSettingsResponse> {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).length === 0 ||
    Object.keys(input).some((key) => !ALLOWED_FIELDS.has(key))) throw new GuildSettingsError('Invalid settings fields');
  if (input.welcomeVoiceTts !== undefined && typeof input.welcomeVoiceTts !== 'boolean') throw new GuildSettingsError('Invalid voice greeting flag');
  if (input.welcomeMessage !== undefined && (typeof input.welcomeMessage !== 'string' ||
    !input.welcomeMessage.trim() || input.welcomeMessage.length > 200 ||
    [...input.welcomeMessage.matchAll(/\{([^{}]*)\}/g)].some((match) => match[1] !== 'user') ||
    /[{}]/.test(input.welcomeMessage.replace(/\{user\}/g, '')))) throw new GuildSettingsError('Invalid greeting template');
  if (input.reportChannelId !== undefined && input.reportChannelId !== null) {
    if (typeof input.reportChannelId !== 'string' || !/^[0-9A-Za-z_-]{1,100}$/.test(input.reportChannelId)) throw new GuildSettingsError('Invalid report channel');
    const channel = await guild.channels.fetch(input.reportChannelId).catch(() => null);
    const bot = guild.members.me;
    if (!channel || channel.guildId !== guild.id || channel.type !== ChannelType.GuildText || !bot ||
      !channel.permissionsFor(bot)?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks])) {
      throw new GuildSettingsError('Bot cannot send embeds in that text channel');
    }
  }
  const set: Record<string, unknown> = { name: guild.name, updatedAt: new Date() };
  if (input.welcomeVoiceTts !== undefined) set.welcomeVoiceTts = input.welcomeVoiceTts;
  if (input.welcomeMessage !== undefined) set.welcomeMessage = input.welcomeMessage;
  if (typeof input.reportChannelId === 'string') set.reportChannelId = input.reportChannelId;
  const update: Record<string, unknown> = { $set: set };
  if (input.reportChannelId === null) update.$unset = { reportChannelId: 1 };
  const config = await GuildConfigModel.findOneAndUpdate({ guildId: guild.id }, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  return responseFrom(guild, config);
}
