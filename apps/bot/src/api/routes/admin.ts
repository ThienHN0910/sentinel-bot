import { PermissionFlagsBits, type Client } from 'discord.js';
import type { FastifyInstance } from 'fastify';
import type { GuildSettingsInput } from '@sentinel/shared';
import { AuthFailure, requireSession, SESSION_COOKIE, verifyMutation } from '../../services/auth/sessions';
import { authorizeGuildManager, GuildAuthorizationError } from '../../services/auth/guildAuthorization';
import { GuildSettingsError, readGuildSettings, saveGuildSettings } from '../../services/settings/GuildSettingsService';

export async function registerAdminRoutes(app: FastifyInstance, client?: Client) {
  app.get('/api/admin/guilds', async (request, reply) => {
    try {
      const session = await requireSession(request);
      const candidates = session.oauthGuilds.filter((item) => {
        try { return item.owner || (BigInt(item.permissions) & PermissionFlagsBits.ManageGuild) !== 0n; }
        catch { return false; }
      });
      const guilds: { id: string; name: string }[] = [];
      for (let offset = 0; offset < candidates.length; offset += 10) {
        const batch = await Promise.all(candidates.slice(offset, offset + 10).map(async (candidate) => {
          try {
            const guild = await authorizeGuildManager(client, candidate.id, session.userId);
            return { id: guild.id, name: guild.name };
          } catch { return null; }
        }));
        guilds.push(...batch.filter((guild): guild is { id: string; name: string } => !!guild));
      }
      return { guilds };
    } catch (error) {
      if (error instanceof AuthFailure) return reply.code(error.statusCode).send({ error: error.message });
      throw error;
    }
  });

  app.get('/api/admin/guilds/:guildId/settings', async (request, reply) => {
    try {
      const session = await requireSession(request);
      const { guildId } = request.params as { guildId: string };
      const guild = await authorizeGuildManager(client, guildId, session.userId);
      return readGuildSettings(guild);
    } catch (error) {
      if (error instanceof AuthFailure || error instanceof GuildAuthorizationError) return reply.code(error.statusCode).send({ error: error.message });
      throw error;
    }
  });

  app.patch('/api/admin/guilds/:guildId/settings', { config: { rateLimit: {
    max: 30, timeWindow: '1 minute', keyGenerator: (request) => request.cookies[SESSION_COOKIE] || request.ip
  } } }, async (request, reply) => {
    try {
      const session = await requireSession(request);
      verifyMutation(request, session);
      const { guildId } = request.params as { guildId: string };
      const guild = await authorizeGuildManager(client, guildId, session.userId);
      return await saveGuildSettings(guild, request.body as GuildSettingsInput);
    } catch (error) {
      if (error instanceof AuthFailure || error instanceof GuildAuthorizationError) return reply.code(error.statusCode).send({ error: error.message });
      if (error instanceof GuildSettingsError) return reply.code(400).send({ error: error.message });
      throw error;
    }
  });
}
