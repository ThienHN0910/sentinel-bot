import type { GameAction, GameKind, GameSessionView, GuildSettingsInput, GuildSettingsResponse, RankingMetric, RankingPage } from '@sentinel/shared';

const configured = import.meta.env.VITE_API_URL?.trim();
export const API_BASE_URL = (configured || 'https://sentinel-bot.thienhn.io.vn').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public readonly status: number, message: string) { super(message); }
}

async function requestJson<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, { cache: 'no-store', credentials: 'include', ...options });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new ApiError(response.status, body?.error || `API returned ${response.status}`);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

export async function getJson<T>(path: string): Promise<T> {
  return requestJson<T>(path);
}

export async function postJson<T>(path: string): Promise<T> {
  return requestJson<T>(path, { method: 'POST' });
}

export function getRankingPage(guildId: string, metric: RankingMetric, cursor?: string): Promise<RankingPage> {
  const query = new URLSearchParams({ metric });
  if (cursor) query.set('cursor', cursor);
  return getJson<RankingPage>(`/api/guilds/${encodeURIComponent(guildId)}/rankings?${query.toString()}`);
}

export interface AuthMeResponse {
  user: { id: string; username: string; avatar: string | null };
  csrfToken: string;
}

export function getAuthMe(): Promise<AuthMeResponse> {
  return getJson<AuthMeResponse>('/api/auth/me');
}

export function getManagedGuilds(): Promise<{ guilds: { id: string; name: string }[] }> {
  return getJson('/api/admin/guilds');
}

export function getGuildSettings(guildId: string): Promise<GuildSettingsResponse> {
  return getJson(`/api/admin/guilds/${encodeURIComponent(guildId)}/settings`);
}

export function patchGuildSettings(guildId: string, input: GuildSettingsInput, csrfToken: string): Promise<GuildSettingsResponse> {
  return requestJson(`/api/admin/guilds/${encodeURIComponent(guildId)}/settings`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify(input)
  });
}

export function logoutSession(csrfToken: string): Promise<void> {
  return requestJson('/api/auth/logout', { method: 'POST', headers: { 'x-csrf-token': csrfToken } });
}

export function getGameSession(sessionId: string): Promise<GameSessionView> {
  return getJson(`/api/games/${encodeURIComponent(sessionId)}`);
}

export function createGameSession(guildId: string, kind: GameKind, csrfToken: string): Promise<GameSessionView> {
  return requestJson('/api/games', { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify({ guildId, kind }) });
}

export function actOnGameSession(sessionId: string, action: GameAction, csrfToken: string): Promise<GameSessionView> {
  return requestJson(`/api/games/${encodeURIComponent(sessionId)}/actions`, { method: 'POST',
    headers: { 'content-type': 'application/json', 'x-csrf-token': csrfToken },
    body: JSON.stringify(action) });
}
