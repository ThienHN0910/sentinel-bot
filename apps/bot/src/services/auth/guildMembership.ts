import type { Client } from 'discord.js';

export class GuildMembershipError extends Error {
  constructor(public readonly statusCode: 403 | 404, message: string) { super(message); }
}

export async function authorizeGuildMember(client: Client | undefined, guildId: string, userId: string): Promise<void> {
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) throw new GuildMembershipError(404, 'Bot is not in this server');
  try {
    await guild.members.fetch({ user: userId, force: true });
  } catch {
    throw new GuildMembershipError(403, 'Current server membership could not be confirmed');
  }
}
