import type { Client } from 'discord.js';
import type { FastifyInstance, FastifyReply } from 'fastify';
import type { GameAction, GameKind } from '@sentinel/shared';
import { AuthFailure, requireSession, SESSION_COOKIE, verifyMutation } from '../../services/auth/sessions';
import { authorizeGuildMember, GuildMembershipError } from '../../services/auth/guildMembership';
import { GameSessionError, createGameSession, getGameSession, actOnGameSession } from '../../services/game/GameSessionService';
import { GameRuleError } from '../../services/game/sessionRules';
import { syncGameMessage } from '../../commands/gameSessions';

const RATE_LIMIT = { max: 20, timeWindow: '1 minute',
  keyGenerator: (request: { cookies: Record<string, string | undefined>; ip: string }) =>
    request.cookies[SESSION_COOKIE] || request.ip } as const;

function sendFailure(error: unknown, reply: FastifyReply) {
  if (error instanceof AuthFailure || error instanceof GuildMembershipError) {
    return reply.code(error.statusCode).send({ error: error.message });
  }
  if (error instanceof GameSessionError) {
    return reply.code(error.code === 'not_found' ? 404 : error.code === 'forbidden' ? 403 : 409)
      .send({ error: error.message });
  }
  if (error instanceof GameRuleError) {
    const status = error.code === 'expired' ? 410 : error.code === 'forbidden' ? 403 :
      error.code === 'conflict' ? 409 : 400;
    return reply.code(status).send({ error: error.message });
  }
  throw error;
}

function validAction(value: unknown): value is GameAction {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const action = value as Record<string, unknown>;
  if (action.type === 'join') return Object.keys(action).length === 1;
  if (action.type === 'place') return Object.keys(action).length === 2 &&
    Number.isInteger(action.cell) && Number(action.cell) >= 0 && Number(action.cell) <= 8;
  if (action.type === 'choose') return Object.keys(action).length === 2 &&
    ['rock', 'paper', 'scissors'].includes(action.choice as string);
  return false;
}

export async function registerGameRoutes(app: FastifyInstance, client?: Client) {
  app.get('/api/games/guilds', async (request, reply) => {
    try {
      const session = await requireSession(request);
      reply.header('Cache-Control', 'no-store');
      return { guilds: session.oauthGuilds.map(({ id }) => client?.guilds.cache.get(id))
        .filter((guild): guild is NonNullable<typeof guild> => !!guild)
        .map(({ id, name }) => ({ id, name })) };
    } catch (error) { return sendFailure(error, reply); }
  });
  app.get('/api/games/:sessionId', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    try {
      let viewerId: string | undefined;
      try { viewerId = (await requireSession(request)).userId; }
      catch (error) { if (!(error instanceof AuthFailure && error.statusCode === 401)) throw error; }
      const { sessionId } = request.params as { sessionId: string };
      return await getGameSession(sessionId, viewerId);
    } catch (error) { return sendFailure(error, reply); }
  });

  app.post('/api/games', { config: { rateLimit: RATE_LIMIT } }, async (request, reply) => {
    try {
      const session = await requireSession(request);
      verifyMutation(request, session);
      const body = request.body as { guildId?: unknown; kind?: unknown } | null;
      if (!body || typeof body.guildId !== 'string' || !/^\d{5,25}$/.test(body.guildId) ||
        (body.kind !== 'tictactoe' && body.kind !== 'rps')) {
        return reply.code(400).send({ error: 'Invalid game request' });
      }
      await authorizeGuildMember(client, body.guildId, session.userId);
      const view = await createGameSession({ guildId: body.guildId, creatorId: session.userId, kind: body.kind as GameKind });
      return reply.code(201).send(view);
    } catch (error) { return sendFailure(error, reply); }
  });

  app.post('/api/games/:sessionId/actions', { config: { rateLimit: RATE_LIMIT } }, async (request, reply) => {
    try {
      const session = await requireSession(request);
      verifyMutation(request, session);
      const { sessionId } = request.params as { sessionId: string };
      if (!validAction(request.body)) return reply.code(400).send({ error: 'Invalid game action' });
      const current = await getGameSession(sessionId, session.userId);
      await authorizeGuildMember(client, current.guildId, session.userId);
      const updated = await actOnGameSession(sessionId, session.userId, request.body);
      await syncGameMessage(client, updated).catch(error => app.log.warn({ error }, 'Could not update Discord game message'));
      return updated;
    } catch (error) { return sendFailure(error, reply); }
  });
}
