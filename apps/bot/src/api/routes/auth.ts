import type { FastifyInstance } from 'fastify';
import { discordAuthorizationUrl, exchangeDiscordCode, oauthConfig } from '../../services/auth/discordOAuth';
import { AuthFailure, consumeOAuthState, createOAuthState, createSession, requireSession, revokeSession, SESSION_COOKIE, SESSION_SECONDS, STATE_COOKIE, verifyMutation } from '../../services/auth/sessions';

const secureCookie = { path: '/', httpOnly: true, secure: true, sameSite: 'lax' as const };

export async function registerAuthRoutes(app: FastifyInstance) {
  app.get('/api/auth/discord/start', { config: { rateLimit: { max: 20, timeWindow: '1 minute' } } }, async (request, reply) => {
    try {
      oauthConfig();
      const { return_to: requested } = request.query as { return_to?: unknown };
      const returnPath = typeof requested === 'string' &&
        (/^\/games\/[A-Za-z0-9_-]{21}$/.test(requested) || requested === '/games/new') ? requested : undefined;
      const state = await createOAuthState(returnPath);
      reply.setCookie(STATE_COOKIE, state, { ...secureCookie, maxAge: 600 });
      return reply.redirect(discordAuthorizationUrl(state));
    } catch {
      return reply.code(503).send({ error: 'Discord login unavailable' });
    }
  });

  app.get('/api/auth/discord/callback', async (request, reply) => {
    const { code, state } = request.query as { code?: string; state?: string };
    if (typeof code !== 'string' || !code || typeof state !== 'string') return reply.code(400).send({ error: 'Invalid OAuth callback' });
    let consumed: { valid: boolean; returnPath: string | null };
    try { consumed = await consumeOAuthState(state, request.cookies[STATE_COOKIE]); }
    catch { return reply.code(503).send({ error: 'Login state unavailable' }); }
    if (!consumed.valid) return reply.code(400).send({ error: 'Invalid or expired OAuth state' });
    try {
      const { user, guilds } = await exchangeDiscordCode(code);
      const session = await createSession(user, guilds);
      reply.setCookie(SESSION_COOKIE, session, { ...secureCookie, maxAge: SESSION_SECONDS });
      reply.clearCookie(STATE_COOKIE, secureCookie);
      return reply.redirect(`${oauthConfig().frontendUrl}${consumed.returnPath || '/dashboard/manage'}`);
    } catch {
      return reply.code(502).send({ error: 'Discord login failed' });
    }
  });

  app.get('/api/auth/me', async (request, reply) => {
    try {
      const session = await requireSession(request);
      return { user: { id: session.userId, username: session.username, avatar: session.avatar }, csrfToken: session.csrfToken };
    } catch (error) {
      if (error instanceof AuthFailure) return reply.code(error.statusCode).send({ error: error.message });
      throw error;
    }
  });

  app.post('/api/auth/logout', async (request, reply) => {
    try {
      const session = await requireSession(request);
      verifyMutation(request, session);
      await revokeSession(request);
      reply.clearCookie(SESSION_COOKIE, secureCookie);
      return reply.code(204).send();
    } catch (error) {
      if (error instanceof AuthFailure) return reply.code(error.statusCode).send({ error: error.message });
      throw error;
    }
  });
}
