# Dashboard Rankings and Server Administration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let visitors browse full chat, completed-voice, and XP rankings while authorized server managers configure voice greetings and cumulative weekly reports through Discord login.

**Architecture:** Keep Fastify on the bot VPS as the only API and auth backend. MongoDB stores ranking data, opaque login sessions, and report delivery state; Vue on Vercel uses credentialed API requests. Discord remains the authority for current server ownership and Manage Server permission.

**Tech Stack:** Node.js 20, TypeScript, Fastify 4, discord.js 14, Mongoose 8, Vue 3, Vitest, pnpm 9, MongoDB.

**Spec:** `docs/superpowers/specs/2026-09-28-dashboard-admin-foundation-design.md`

## Global Constraints

- Public rankings need no login; every settings read and write needs a valid session and current guild permission.
- Rank all saved `UserStat` records, including former members; use 25 rows per page and cursor pagination, never a full-guild array or growing `skip` offset.
- Chat uses cumulative messages, voice uses completed seconds, and level ranks by cumulative XP with `calculateLevel(exp)`; active voice remains an estimate on the dashboard.
- Only a server owner or member with Discord's Manage Server permission may manage that server; fail closed if Discord cannot confirm permission.
- Store only a hashed opaque session ID in MongoDB for seven absolute days; send its plaintext value in a host-only `HttpOnly`, `Secure`, `SameSite=Lax` cookie. Keep OAuth secrets and tokens out of browser storage.
- Reports run Monday 09:00–18:00 `Asia/Ho_Chi_Minh`, retry hourly after failures, and label top chat and completed voice as cumulative; omit expiring word rankings.
- Keep the existing top-ten leaderboard route compatible and preserve current voice greeting behavior unless an authorized manager changes its setting.
- Put new secrets only in the VPS environment and `.env.example` placeholders; log any VPS commands in ignored `.diagnostics/` before running them.

## Review Focus

- A cursor from another guild or metric, or a malformed/oversized cursor, returns 400 without reading another guild's data; Task 1 tests this.
- Two members with the same score at a page boundary appear once each in deterministic user-ID order; Task 1 tests this.
- An OAuth callback with expired/reused state creates no session, and a replayed code is rejected; Task 3 tests this.
- A manager who loses Manage Server after login gets 403 on the next settings read and write; Task 4 tests this.
- A Monday send failure, a bot restart, or two overlapping scheduler ticks cannot cause unbounded retries or routine duplicate reports; Task 6 tests this.

---

## File map

| Unit | Responsibility | Files |
| --- | --- | --- |
| Ranking query | Validate metric/cursor, fetch one indexed page, derive level | `apps/bot/src/services/analytics/rankings.ts`, `apps/bot/src/api/routes/rankings.ts`, `apps/bot/src/models/UserStat.ts` |
| Ranking UI | Public tabs, cursor navigation, explicit voice units | `apps/web/src/views/RankingsView.vue`, `apps/web/src/api.ts` |
| Login/session | OAuth exchange, one-time state, session cookie and CSRF | `apps/bot/src/services/auth/discordOAuth.ts`, `apps/bot/src/services/auth/sessions.ts`, `apps/bot/src/api/routes/auth.ts`, `apps/bot/src/models/AuthState.ts`, `apps/bot/src/models/AuthSession.ts` |
| Authorization/settings | Check current Discord permission and validate guild config | `apps/bot/src/services/auth/guildAuthorization.ts`, `apps/bot/src/services/settings/GuildSettingsService.ts`, `apps/bot/src/api/routes/admin.ts` |
| Management UI | Login status, guild selector, guarded settings form | `apps/web/src/views/ManageView.vue`, `apps/web/src/stores/auth.ts` |
| Weekly delivery | Cumulative report, retry window, per-week delivery lease | `apps/bot/src/services/analytics/WeeklyReportCron.ts`, `apps/bot/src/models/ReportDelivery.ts`, `apps/bot/src/index.ts` |

### Task 1: Indexed public ranking API

**Files:** Create `apps/bot/src/services/analytics/rankings.ts`, `apps/bot/src/api/routes/rankings.ts`, `apps/bot/tests/rankings.test.ts`; modify `apps/bot/src/models/UserStat.ts`, `apps/bot/src/api/server.ts`, `apps/bot/src/api/routes/leaderboard.ts`, `packages/shared/src/types/index.ts`.

**Interfaces:** Produce `RankingMetric = 'chat' | 'voice' | 'level'`, `RankingRow { rank,userId,username,avatar,score,level? }`, `RankingPage { rows,nextCursor,generatedAt }`; `getRankingPage(guildId: string, metric: RankingMetric, cursor?: string): Promise<RankingPage>`. The new route is `GET /api/guilds/:guildId/rankings?metric=...&cursor=...`; keep the old leaderboard response shape.

- [ ] **Step 1: Write failing tests.** `rankings.test.ts` asserts 26 records yield ranks 1–25 then 26; tied scores cross the boundary in user-ID order with no duplicate; a cursor bound to a different guild/metric and a 2 KB cursor return 400; unknown guild returns 404; level rows are ordered by XP and `calculateLevel(282) === 2`, even when stored `level === 1`; public rows omit coins.
- [ ] **Step 2: Confirm red.** Run `pnpm --filter @sentinel/bot test -- rankings.test.ts`; expect failures for the missing route/service or wrong level order.
- [ ] **Step 3: Implement.** Use a validated base64url cursor containing guild, metric, last score, user ID, and rank offset; query score descending/user ID ascending with `limit(26)` and projection. Add three compound indexes and change the old top-level query to sort by XP and derive the returned level from XP.
- [ ] **Step 4: Confirm green.** Run the focused test, `pnpm --filter @sentinel/shared typecheck`, and `pnpm --filter @sentinel/bot typecheck`; require all to pass.
- [ ] **Step 5: Commit.** Commit the API, shared DTO, indexes, and tests as `feat: add paginated public rankings`.

### Task 2: Public ranking page

**Files:** Create `apps/web/src/views/RankingsView.vue`, `apps/web/tests/rankings.test.ts`; modify `apps/web/src/api.ts`, `apps/web/src/router/index.ts`, `apps/web/src/views/DashboardView.vue`, `apps/web/src/App.vue`, `apps/web/package.json`, `pnpm-lock.yaml`.

**Interfaces:** Consume Task 1 `RankingPage` through `getRankingPage(guildId, metric, cursor?)`. Route `/dashboard/rankings` accepts selected guild and metric; keep dashboard's public guild selector and 30-second refresh.

- [ ] **Step 1: Write failing tests.** `rankings.test.ts` checks query/path encoding, next/previous cursor-stack behavior, and that a guild or tab change clears old rows/cursors. Assert voice units say completed time and the level tab displays both level and XP.
- [ ] **Step 2: Confirm red.** Run `pnpm --filter @sentinel/web test -- rankings.test.ts`; expect missing view/helper failures.
- [ ] **Step 3: Implement.** Add Vue 3 component test utilities and a DOM test environment as web dev dependencies. Add a “Xem tất cả” link from the dashboard podium, three tabs, 25-row table/list, loading/empty/error states, and cursor navigation. Use `usePageSeo(..., false)` for live rankings and preserve the selected guild across navigation.
- [ ] **Step 4: Confirm green.** Run the focused test, web typecheck, and web build; require all to pass.
- [ ] **Step 5: Commit.** Commit as `feat: show full dashboard rankings`.

### Task 3: Discord OAuth and server-side sessions

**Files:** Create `apps/bot/src/models/AuthState.ts`, `apps/bot/src/models/AuthSession.ts`, `apps/bot/src/services/auth/discordOAuth.ts`, `apps/bot/src/services/auth/sessions.ts`, `apps/bot/src/api/routes/auth.ts`, `apps/bot/tests/auth.test.ts`; modify `apps/bot/src/api/server.ts`, `apps/bot/package.json`, `pnpm-lock.yaml`, `.env.example`.

**Interfaces:** Produce `requireSession(request): Promise<{ userId: string; csrfToken: string; oauthGuilds: OAuthGuild[] }>` and `registerAuthRoutes(app)`. Routes: `GET /api/auth/discord/start`, `GET /api/auth/discord/callback`, `GET /api/auth/me`, `POST /api/auth/logout`. `GET /api/auth/me` returns user identity and CSRF token, never Discord access token. `OAuthGuild` contains ID, owner flag, and permission bits from login.

- [ ] **Step 1: Write failing tests.** `auth.test.ts` asserts `state` is single-use with a ten-minute expiry; invalid/expired/reused state and failed code exchange set no session cookie; success sets a host-only `HttpOnly; Secure; SameSite=Lax` cookie with seven-day maximum age; `/me` rejects expiry; logout revokes the session; a POST without matching Origin or CSRF token is rejected. Mock Discord HTTP, never call live OAuth in tests.
- [ ] **Step 2: Confirm red.** Run `pnpm --filter @sentinel/bot test -- auth.test.ts`; expect missing route/model failures.
- [ ] **Step 3: Implement.** Use Node crypto for random state/session/CSRF values and HMAC-SHA256 of session IDs with `SESSION_SECRET` at rest. Use Fastify 4-compatible `@fastify/cookie` 9.x and `@fastify/rate-limit` 9.x; limit authenticated writes by session and login starts by trusted client address without trusting arbitrary forwarding headers. Call Discord's token, `/users/@me`, and `/users/@me/guilds` endpoints with bounded timeouts. Consume state atomically; store no access/refresh token. Register cookies before auth hooks; set exact dashboard CORS origin and credentials; whitelist the post-login redirect. Add `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`, `FRONTEND_URL`, and `SESSION_SECRET` placeholders.
- [ ] **Step 4: Confirm green.** Run focused tests, bot typecheck, and bot build; require all to pass. Confirm no token/code/session value appears in response bodies or logs.
- [ ] **Step 5: Commit.** Commit as `feat: add Discord login and server sessions`.

### Task 4: Current guild permission and settings API

**Files:** Create `apps/bot/src/services/auth/guildAuthorization.ts`, `apps/bot/src/services/settings/GuildSettingsService.ts`, `apps/bot/src/api/routes/admin.ts`, `apps/bot/tests/adminSettings.test.ts`; modify `apps/bot/src/api/server.ts`, `packages/shared/src/types/index.ts`.

**Interfaces:** Consume Task 3 `requireSession`; produce `authorizeGuildManager(client, guildId, userId): Promise<Guild>` and `readGuildSettings(guild): Promise<GuildSettingsResponse>` / `saveGuildSettings(guild, input: GuildSettingsInput): Promise<GuildSettingsResponse>`. Routes: `GET /api/admin/guilds`, `GET/PATCH /api/admin/guilds/:guildId/settings`. `GuildSettingsInput` allows only `welcomeVoiceTts`, `welcomeMessage`, and nullable `reportChannelId`; `GuildSettingsResponse` adds available writable text channels.

- [ ] **Step 1: Write failing tests.** `adminSettings.test.ts` asserts owner and current Manage Server member can read/write; a member whose permission was revoked after OAuth gets 403 on both operations; missing bot guild returns 404; Discord fetch failure grants no access; unknown fields, unsupported template variable, and too-long message return 400; a channel outside the guild or without send/embed permission is rejected; clearing channel disables reports; unauthenticated calls return 401.
- [ ] **Step 2: Confirm red.** Run `pnpm --filter @sentinel/bot test -- adminSettings.test.ts`; expect missing routes/service failures.
- [ ] **Step 3: Implement.** Fetch the guild/member from the bot on each settings request, check owner ID or `PermissionFlagsBits.ManageGuild`, validate a maximum 200-character greeting and only `{user}`, and persist only the three allowlisted fields with updated timestamp. Filter channel choices by bot `SendMessages` and `EmbedLinks`. Enforce Task 3 Origin/CSRF guard on PATCH.
- [ ] **Step 4: Confirm green.** Run focused tests and bot typecheck; require both to pass.
- [ ] **Step 5: Commit.** Commit as `feat: authorize per-server settings`.

### Task 5: Management UI and privacy copy

**Files:** Create `apps/web/src/views/ManageView.vue`, `apps/web/tests/manage.test.ts`; modify `apps/web/src/api.ts`, `apps/web/src/stores/auth.ts`, `apps/web/src/router/index.ts`, `apps/web/src/App.vue`, `apps/web/src/views/PrivacyView.vue`, `docs/discord-developer-portal.md`.

**Interfaces:** Consume Task 3 `/api/auth/me` and Task 4 admin routes. `getJson` and mutation helpers use `credentials: 'include'` only for API requests; PATCH/POST attach the session CSRF token. Browser stores no Discord token. Route `/dashboard/manage` uses noindex SEO.

- [ ] **Step 1: Write failing tests.** `manage.test.ts` asserts logged-out view links to OAuth start; owner/manager guild list comes from the API; 401 prompts login, 403 shows lost permission without clearing form, and a failed save preserves unsaved values; a successful save updates the form; API helpers include credentials and CSRF while never writing tokens to localStorage.
- [ ] **Step 2: Confirm red.** Run `pnpm --filter @sentinel/web test -- manage.test.ts`; expect missing route/view/helper failures.
- [ ] **Step 3: Implement.** Replace the inert in-memory auth token store with `/me` session state, add login/logout and server settings form, select only writable text channels, and show precise pending/empty/error/saved states. Update Privacy Policy with identity, guild permission, cookie, seven-day retention, and logout; document the exact Discord OAuth callback URL and required environment variables.
- [ ] **Step 4: Confirm green.** Run focused tests, web typecheck, web build, and `pnpm --filter @sentinel/web verify:seo`; require all to pass.
- [ ] **Step 5: Commit.** Commit as `feat: add authenticated server management UI`.

### Task 6: Weekly cumulative report delivery

**Files:** Create `apps/bot/src/models/ReportDelivery.ts`; modify `apps/bot/src/services/analytics/WeeklyReportCron.ts`, `apps/bot/src/index.ts`, `apps/bot/tests/analytics.test.ts`.

**Interfaces:** Produce `generateWeeklySummary(client, now = new Date()): Promise<void>` and `scheduleWeeklyReports(client): { stop(): void }`. A unique `(guildId, weekStart)` report record stores delivery status and a short lease; `weekStart` is the Monday date in `Asia/Ho_Chi_Minh`. Only configured `reportChannelId` values participate.

- [ ] **Step 1: Write failing tests.** Add tests that Monday 09:00 `Asia/Ho_Chi_Minh` schedules a send; report title/body say cumulative chat and completed voice as of send time and contain no word ranking; two overlapping ticks send once; a failed channel send is retried on the next Monday hour; a restart with a sent record does not resend; nothing is sent after Monday 18:00 or for a cleared channel.
- [ ] **Step 2: Confirm red.** Run `pnpm --filter @sentinel/bot test -- analytics.test.ts`; expect the new scheduling/delivery assertions to fail.
- [ ] **Step 3: Implement.** Use node-cron with an explicit timezone and hourly Monday 09:00–18:00 window. Acquire a per-guild/week lease atomically, send one cumulative top-three embed, then mark sent; let failed leases expire for the next hourly attempt. Start only after Discord ready and stop during shutdown. Acknowledge the documented crash-after-send duplicate window.
- [ ] **Step 4: Confirm green.** Run focused tests, `pnpm -r test`, `pnpm -r typecheck`, and `pnpm -r build`; require all to pass. Run `git diff --check` and inspect generated static routes/SEO.
- [ ] **Step 5: Commit.** Commit as `feat: send cumulative weekly reports`.

## Release and verification

- Register `https://sentinel-bot.thienhn.io.vn/api/auth/discord/callback` as the Discord OAuth redirect and configure the four server-side environment variables before enabling login. Keep secrets out of the repo and browser build.
- Inspect MongoDB index creation and query plans for the three ranking sorts; check the 25-row limit on a guild with more than one page.
- Deploy bot/API before web. Log every VPS command in the ignored `.diagnostics/` Markdown log **before** running it. Check `/api/health`, public rankings, OAuth callback/cookie behavior, 401/403 paths, settings persistence, and report scheduler logs. Then deploy web and verify both authorized and unauthorized browser flows.
- Update Issue #2 with test and deployment evidence and only move it to `ready-for-human` for any external credential/portal step that remains; close it after the release meets the spec's acceptance criteria.
