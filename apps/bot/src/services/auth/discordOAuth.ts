import type { OAuthGuild } from '../../models/AuthSession';

export interface DiscordIdentity {
  id: string;
  username: string;
  avatar: string | null;
}

export function oauthConfig() {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const clientSecret = process.env.DISCORD_CLIENT_SECRET;
  const redirectUri = process.env.DISCORD_REDIRECT_URI;
  const frontendUrl = process.env.FRONTEND_URL;
  if (!clientId || !clientSecret || !redirectUri || !frontendUrl || !process.env.SESSION_SECRET) {
    throw new Error('Discord OAuth is not configured');
  }
  return { clientId, clientSecret, redirectUri, frontendUrl: frontendUrl.replace(/\/$/, '') };
}

export function discordAuthorizationUrl(state: string): string {
  const { clientId, redirectUri } = oauthConfig();
  const query = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'identify guilds',
    state
  });
  return `https://discord.com/oauth2/authorize?${query}`;
}

async function discordRequest<T>(url: string, accessToken: string): Promise<T> {
  const response = await fetch(url, {
    headers: { authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`Discord API returned ${response.status}`);
  return response.json() as Promise<T>;
}

export async function exchangeDiscordCode(code: string): Promise<{ user: DiscordIdentity; guilds: OAuthGuild[] }> {
  const { clientId, clientSecret, redirectUri } = oauthConfig();
  const response = await fetch('https://discord.com/api/v10/oauth2/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, grant_type: 'authorization_code', code, redirect_uri: redirectUri }),
    signal: AbortSignal.timeout(8_000)
  });
  if (!response.ok) throw new Error(`Discord token exchange returned ${response.status}`);
  const token = await response.json() as { access_token?: string };
  if (!token.access_token) throw new Error('Discord token response lacked access token');
  const [user, guilds] = await Promise.all([
    discordRequest<DiscordIdentity>('https://discord.com/api/v10/users/@me', token.access_token),
    discordRequest<OAuthGuild[]>('https://discord.com/api/v10/users/@me/guilds', token.access_token)
  ]);
  if (!user?.id || !user.username || !Array.isArray(guilds)) throw new Error('Invalid Discord identity response');
  return { user, guilds };
}
