import { PermissionFlagsBits, type Client, type Guild } from 'discord.js';

export class GuildAuthorizationError extends Error {
  constructor(public readonly statusCode: 403 | 404, message: string) { super(message); }
}

export async function authorizeGuildManager(client: Client | undefined, guildId: string, userId: string): Promise<Guild> {
  const guild = client?.guilds.cache.get(guildId);
  if (!guild) throw new GuildAuthorizationError(404, 'Bot is not in this server');
  let currentGuild: Guild;
  try {
    currentGuild = await client!.guilds.fetch({ guild: guildId, force: true });
  } catch {
    throw new GuildAuthorizationError(403, 'Could not confirm current server ownership and roles');
  }
  if (currentGuild.ownerId === userId) return currentGuild;
  try {
    const member = await currentGuild.members.fetch({ user: userId, force: true });
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return currentGuild;
  } catch {
    throw new GuildAuthorizationError(403, 'Could not confirm Manage Server permission');
  }
  throw new GuildAuthorizationError(403, 'Manage Server permission required');
}
