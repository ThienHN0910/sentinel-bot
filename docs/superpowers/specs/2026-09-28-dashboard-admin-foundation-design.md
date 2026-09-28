# Sentinel dashboard rankings and server administration

Date: 2026-09-28

## Intent and scope

Members need to browse every recorded participant in the chat, voice, and level rankings instead of seeing only the dashboard's top three or ten. Server owners and members with Discord's **Manage Server** permission need to sign in before changing Sentinel's settings for their server. The first release exposes the existing voice greeting and a cumulative activity report sent weekly. It should remain responsive on larger servers and on the current Oracle VPS.

This is the first of three subprojects. Member join/rejoin greetings and configurable announcements follow after the administration foundation. A lightweight UI game follows separately. Those later features need their own requirements and specs; in particular, “returning member” must be defined before a greeting is built. Public rankings remain readable without login, while all settings reads and writes require login and server authorization.

## Current behavior and defects

- `DashboardView.vue` renders the API's top three chat users and top ten voice users. The existing leaderboard API returns at most ten users per metric and has no pagination.
- `UserStat` stores cumulative message count, completed voice seconds, and XP. Active voice sessions are stored separately and shown as an estimate on the dashboard. Rankings have no index tailored to score ordering.
- XP increases on message and voice activity, but the stored `level` field is not updated on those writes. Ranking by that field gives misleading results. The shared package already defines `calculateLevel(totalExp)`.
- The web auth store is only in memory. The bot API has no OAuth flow, session, or per-server authorization. Existing CORS permits every origin.
- `GuildConfig` already contains `welcomeVoiceTts`, `welcomeMessage`, and `reportChannelId`. Voice greetings read the first two. A weekly report function exists but its scheduler is never started. It labels cumulative rankings as a weekly report.

## Chosen architecture

Keep Fastify on the bot VPS as the only API and authentication backend. Vue on Vercel calls it over HTTPS. Discord OAuth2 Authorization Code flow requests `identify` and `guilds`, checks a short-lived `state`, exchanges the code server-side, reads the Discord user identity and guild list, and creates an opaque server-side session. The session ID is rotated at login, stored hashed with an absolute seven-day expiry in MongoDB, and sent only as a host-only `HttpOnly`, `Secure`, `SameSite=Lax` cookie on the bot API domain. Discord access tokens and client secret are never sent to the browser or kept in `localStorage`; access tokens are discarded after login. Logout revokes the session and clears the cookie. The auth surface is `GET /api/auth/discord/start`, `GET /api/auth/discord/callback`, `GET /api/auth/me`, and `POST /api/auth/logout`.

OAuth guild data narrows the server selector to servers where the user is an owner or has Manage Server and Sentinel is installed. It is not the authorization decision for settings. On **every** settings read and write, Fastify checks the active Discord bot guild, confirms ownership or fetches the member's current permissions, and denies access if the user left or lost Manage Server. Fail closed when Discord cannot confirm permissions. Public dashboard and ranking endpoints remain separate from `GET /api/admin/guilds` and `GET/PATCH /api/admin/guilds/:guildId/settings`. Mutating endpoints verify the configured dashboard `Origin` and a session-bound CSRF token. CORS accepts only the configured dashboard origin with credentials; local development has an explicit allowed origin. OAuth redirects only to a fixed configured dashboard URL.

The API owns session, authorization, ranking, and settings operations as separate units. Vue owns views and calls typed API functions; it never decides permission from a client-side flag. The bot continues to own Discord event handling and report delivery. Shared types describe the public ranking and editable settings payloads.

## Public ranking flow

The dashboard keeps its summary and top-three presentation, with a visible “View all” link. A public ranking page has Chat, Voice, and Level tabs for the selected bot server. Each tab requests 25 rows at a time from a new paginated endpoint. The API returns rank, user ID, display name, avatar, score, a next-page cursor, and the time the response was generated. The UI supports next and previous navigation, loading, empty, and API-error states. It includes users who have a saved `UserStat` record even if they later leave the guild; it does not query Discord's full member list.

Chat ranks by cumulative `totalMessages`. Voice ranks by **completed** `totalVoiceSeconds`, so pagination and ties stay stable. The dashboard retains its separate live voice estimate; copy on both pages explains that an active session appears in completed totals after it ends. Level ranks by cumulative `exp` and displays both XP and `calculateLevel(exp)`. All level read paths used by this feature take XP as the source of truth; the stale stored `level` field does not determine ranking. The existing top-ten API remains compatible for current callers, with its level ordering corrected to XP.

`GET /api/guilds/:guildId/rankings?metric=chat|voice|level&cursor=...` uses a fixed page size, a validated opaque cursor containing the metric, last score, user ID, and rank offset, plus a deterministic user-ID tie break. MongoDB compound indexes cover `(guildId, totalMessages desc, userId)`, `(guildId, totalVoiceSeconds desc, userId)`, and `(guildId, exp desc, userId)`. Cursor queries fetch one extra row to detect another page; they do not load the entire guild or use growing `skip` offsets. Page numbers and a full count are not required. Concurrent score changes can move a user between requests, so the UI treats each page as a fresh snapshot rather than promising a frozen tournament table.

## Server settings and weekly report

After login, `/dashboard/manage` lists only manageable installed servers. For a selected server, the form edits `welcomeVoiceTts`, a bounded `welcomeMessage` template supporting `{user}`, and an optional report text channel. Clearing the channel disables reports. The API validates field types and length, accepts only supported template variables, verifies that a selected channel still belongs to the guild, and confirms the bot can send messages and embeds there. The UI shows save confirmation or a specific validation/permission error. Existing settings are retained; no global default is rewritten as part of this release.

Start the report scheduler with the bot after Discord becomes ready and stop it on shutdown. The intended send time is Monday 09:00 in `Asia/Ho_Chi_Minh`. The report explicitly says that top chat and completed-voice figures are **cumulative since Sentinel began recording**, as of its send time. Omit the current word ranking from this report because its collection expires after about 60 days and is not cumulative. A per-guild, per-week delivery record with a unique key guards against routine duplicate sends. A failed send is logged and retried hourly until 18:00 that Monday; a report is skipped if the bot remains unavailable through the retry window. A crash between Discord accepting a message and recording success can still cause one duplicate, so the delivery guarantee is best effort, not exactly once.

## Failure handling, privacy, and deployment

- A missing/expired session returns 401; lack of guild ownership or Manage Server returns 403; a missing bot guild or deleted channel returns 404/validation failure as appropriate. The web sends the user back to login only for 401 and preserves unsaved form values on other errors.
- OAuth callback rejects invalid, expired, or reused state. Session and permission checks fail closed during MongoDB or Discord API outages. Rate-limit login and settings writes, bound request timeouts, and avoid logging OAuth codes, session IDs, or secrets.
- Update the Privacy Policy to describe Discord login identity, guild permissions, session cookie, seven-day session retention, and logout. The management route is excluded from search indexing.
- Configure a Discord OAuth redirect to the existing bot API HTTPS domain. Provide `DISCORD_CLIENT_SECRET`, fixed callback URL, fixed dashboard URL, and session signing/hash secret through the VPS environment; no secrets enter git or Vite variables. Deploy the API and database indexes before the web links to the new endpoints. Verify both domains and the browser cookie flow after release.

## Verification and acceptance

Focused tests cover cursor ordering and ties across all three metrics, cursor validation and page bounds, XP-to-level rendering, active versus completed voice labels, OAuth state and callback failures, session expiry/logout, owner/Manage Server authorization including revoked permissions, CSRF/origin checks, settings validation, and weekly report scheduling/delivery deduplication. Run bot and web tests, type checks, builds, and SEO checks. Smoke-test a real guild on the deployed API and dashboard using an authorized account and an unauthorized account.

Acceptance requires that a visitor can navigate past the initial top users without fetching all records; no editable setting can be read or changed without a valid session and current guild permission; the voice greeting setting changes actual bot behavior; a configured report sends at the intended time with cumulative labels; and no static ranking data replaces live API responses.

## Deferred work

- Join/rejoin greetings and custom scheduled announcements need a separate spec for event definitions, per-server templates, consent/privacy, rate limits, and a safe send queue.
- UI games and additional commands need a separate spec and a measured resource budget. Candidates to evaluate later include a Discord-button quiz or a small web puzzle rather than a continuously running multiplayer game.
