import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { AuthSessionModel, type AuthSession, type OAuthGuild } from '../../models/AuthSession';
import { AuthStateModel } from '../../models/AuthState';
import type { DiscordIdentity } from './discordOAuth';

export const SESSION_COOKIE = 'sentinel_sid';
export const STATE_COOKIE = 'sentinel_oauth_state';
export const SESSION_SECONDS = 7 * 24 * 60 * 60;
const STATE_MINUTES = 10;

export class AuthFailure extends Error {
  constructor(public readonly statusCode: 401 | 403, message: string) { super(message); }
}

function stateHash(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function sessionHash(value: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET is not configured');
  return createHmac('sha256', secret).update(value).digest('hex');
}

export async function createOAuthState(): Promise<string> {
  const value = randomBytes(32).toString('base64url');
  await AuthStateModel.create({ stateHash: stateHash(value), expiresAt: new Date(Date.now() + STATE_MINUTES * 60_000) });
  return value;
}

export async function consumeOAuthState(value: string, cookieValue: string | undefined): Promise<boolean> {
  if (!/^[A-Za-z0-9_-]{40,60}$/.test(value) || !cookieValue || cookieValue.length !== value.length ||
    !timingSafeEqual(Buffer.from(value), Buffer.from(cookieValue))) return false;
  const found = await AuthStateModel.findOneAndDelete({ stateHash: stateHash(value), expiresAt: { $gt: new Date() } }).lean();
  return !!found;
}

export async function createSession(user: DiscordIdentity, oauthGuilds: OAuthGuild[]): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await AuthSessionModel.create({
    tokenHash: sessionHash(token), userId: user.id, username: user.username,
    avatar: user.avatar, csrfToken: randomBytes(32).toString('base64url'), oauthGuilds,
    expiresAt: new Date(Date.now() + SESSION_SECONDS * 1000)
  });
  return token;
}

export async function requireSession(request: FastifyRequest): Promise<AuthSession> {
  const token = request.cookies[SESSION_COOKIE];
  if (!token || !/^[A-Za-z0-9_-]{40,60}$/.test(token)) throw new AuthFailure(401, 'Login required');
  const session = await AuthSessionModel.findOne({ tokenHash: sessionHash(token), expiresAt: { $gt: new Date() } }).lean();
  if (!session) throw new AuthFailure(401, 'Session expired');
  return session;
}

export function verifyMutation(request: FastifyRequest, session: Pick<AuthSession, 'csrfToken'>): void {
  const allowedOrigin = process.env.FRONTEND_URL?.replace(/\/$/, '') || 'http://localhost:5173';
  const origin = request.headers.origin;
  const csrf = request.headers['x-csrf-token'];
  if (origin !== allowedOrigin || typeof csrf !== 'string' || csrf.length !== session.csrfToken.length ||
    !timingSafeEqual(Buffer.from(csrf), Buffer.from(session.csrfToken))) {
    throw new AuthFailure(403, 'Invalid request origin or CSRF token');
  }
}

export async function revokeSession(request: FastifyRequest): Promise<void> {
  const token = request.cookies[SESSION_COOKIE];
  if (token) await AuthSessionModel.deleteOne({ tokenHash: sessionHash(token) });
}
