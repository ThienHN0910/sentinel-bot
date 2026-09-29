# Shared Discord and Web Games Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship cờ 3×3 and oẳn tù tì with one authoritative two-player session usable through Discord buttons and the web.

**Architecture:** A pure rules module computes legal transitions; a MongoDB session service applies them with versioned compare-and-swap. Discord components and authenticated Fastify routes call that service. Vue renders a player-specific projection and polls while the game is active.

**Tech Stack:** TypeScript, discord.js 14, Fastify 4, MongoDB/Mongoose 8, Vue 3/Vite, Vitest, existing Discord OAuth session.

**Spec:** `docs/superpowers/specs/2026-09-29-cross-platform-games-and-utility-commands-design.md`

## Global Constraints

- `/game tictactoe` and `/game rps` are guild-only; `/games/new` may also create a game after guild selection and membership verification. Both surfaces use exactly two different guild members; the creator is X and starts cờ 3×3.
- Waiting games expire after 15 minutes; active games expire after 30 minutes without a valid move; finished/expired games are readable for 24 hours, then deleted.
- Rock/paper/scissors choices stay private until both players choose; no XP, DNE Coins, bets or long-lived match history.
- Web mutations require Discord login, current guild membership, allowed Origin and CSRF token. A session ID alone never authorizes play.
- Discord remains Gateway-based; no Discord Activity, new intent, Embedded App SDK or new product dependency.

## Review Focus

1. Two simultaneous joins or moves never create a third player, overwrite a move or award two results (Task 2 tests).
2. An unauthenticated web request, a user who left the guild or a user from another guild cannot play even with a valid URL (Task 3 tests).
3. A spectator and the opposing player cannot read an unrevealed RPS choice from API or Discord content (Tasks 1, 3 and 4 tests).
4. A timed-out session rejects a late button or API action, remains readable for 24 hours, then expires (Tasks 2 and 4 tests).
5. OAuth return path cannot redirect off-site, and login returns to the same game URL (Task 3 tests).

---

## File map

- `packages/shared/src/types/game.ts`, `packages/shared/src/types/index.ts`: session view and action contracts consumed by bot and web.
- `apps/bot/src/services/game/sessionRules.ts`: pure join/turn/win/RPS and viewer projection logic.
- `apps/bot/src/models/GameSession.ts`: versioned state, creation/expiry and indexes.
- `apps/bot/src/services/game/GameSessionService.ts`: create/read/action/CAS and one-active-created-session constraint.
- `apps/bot/src/services/auth/guildMembership.ts`: current guild membership check for web writes.
- `apps/bot/src/api/routes/games.ts`: public read, authenticated actions, input/rate validation.
- `apps/bot/src/models/AuthState.ts`, `apps/bot/src/services/auth/sessions.ts`, `apps/bot/src/api/routes/auth.ts`: safe OAuth return path for game URLs.
- `apps/bot/src/commands/gameSessions.ts`: Discord components, `/game open` and message updates.
- `apps/bot/src/commands/game.ts`, `apps/bot/src/events/ready.ts`, `apps/bot/src/events/interactionCreate.ts`: new game subcommands and button routing.
- `apps/bot/src/api/server.ts`: game route registration.
- `apps/web/src/api.ts`, `apps/web/src/router/index.ts`, `apps/web/src/views/GameView.vue`: shared session screen and API client.
- `apps/web/src/content/commands.ts`, `README.md`, `apps/web/src/views/PrivacyView.vue`, `docs/discord-developer-portal.md`: feature/retention/Portal documentation.

### Task 1: Rules and projections

**Files:** Create `packages/shared/src/types/game.ts`, `apps/bot/src/services/game/sessionRules.ts`, `apps/bot/tests/gameSessionRules.test.ts`; modify `packages/shared/src/types/index.ts`.

**Interfaces:** Produce `GameKind = 'tictactoe' | 'rps'`, `GameAction = {type:'join'} | {type:'place';cell:number} | {type:'choose';choice:'rock'|'paper'|'scissors'}`, `GameSessionView` (ID, guild, kind, players, phase, expiry, board/turn or selection flags/result and optional Discord message URL). Produce `applyGameRule(session: GameState, actorId: string, action: GameAction, now: Date): GameState` and `projectGame(session: GameState, viewerId?: string): GameSessionView`; invalid transitions throw a typed `GameRuleError` with a public error code.

- [ ] **Step 1: Write failing pure tests.** Assert second distinct user can join, creator cannot join self, X goes first, all eight winning lines and full-board draw, occupied/out-of-turn cells fail, RPS winner matrix and tie, second choice by same player fails, and projection hides opponent's pending choice from both the opponent and spectators.
  ```ts
  it('keeps an unpaired RPS choice private', () => {
    const chosen = applyGameRule(activeRps, 'alice', { type: 'choose', choice: 'rock' }, now);
    expect(projectGame(chosen, 'bob').rps?.ownChoice).toBeUndefined();
    expect(projectGame(chosen).rps?.ownChoice).toBeUndefined();
  });
  ```
- [ ] **Step 2: Run `pnpm --filter @sentinel/bot exec vitest run tests/gameSessionRules.test.ts`; expect failure because rules are absent.**
- [ ] **Step 3: Implement types and pure rules.** Keep one transition per action; never mutate input state; return only viewer-safe DTO. Use numeric cells 0–8 and the spec's 15/30-minute deadlines.
- [ ] **Step 4: Run the same test and `pnpm --filter @sentinel/shared typecheck`; expect both to pass.**
- [ ] **Step 5: Commit types, rules and tests with `feat: define shared game rules`.**

### Task 2: Session persistence and concurrency

**Files:** Create `apps/bot/src/models/GameSession.ts`, `apps/bot/src/services/game/GameSessionService.ts`, `apps/bot/tests/gameSessionService.test.ts`; modify `apps/bot/src/models/index.ts` if model exports are centralized.

**Interfaces:** Produce `createGameSession({guildId,creatorId,kind,channelId?}): Promise<GameSessionView>`, `getGameSession(sessionId, viewerId?): Promise<GameSessionView>`, `actOnGameSession(sessionId, actorId, action, now?: Date): Promise<GameSessionView>`, and `attachGameMessage(sessionId, actorId, guildId, channelId, messageId): Promise<GameSessionView>`. Errors distinguish not found/expired/conflict/invalid action. Return viewer-safe view after applying a transition.

- [ ] **Step 1: Write failing repository tests.** Assert random ID and unique index, one unfinished created session per user/guild, exactly one winner of simultaneous joins/moves via `findOneAndUpdate` filter on `version` and `$inc`, 15-minute wait expiry, 30-minute inactivity reset, rejection after timeout, and `deleteAt` set to end time plus 24 hours with TTL index. Assert only a player can attach one Discord message and a repeated attach returns the current message reference.
  ```ts
  it('commits one move when two writes race', async () => {
    const results = await Promise.allSettled([
      actOnGameSession(id, 'alice', { type: 'place', cell: 0 }),
      actOnGameSession(id, 'alice', { type: 'place', cell: 1 })
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await getGameSession(id)).board?.filter(Boolean)).toHaveLength(1);
  });
  ```
- [ ] **Step 2: Run `pnpm --filter @sentinel/bot exec vitest run tests/gameSessionService.test.ts`; expect failure because service/model are absent.**
- [ ] **Step 3: Implement model and service.** Use Mongo conditional update of one session and bounded conflict retry or explicit 409. Store `expiresAt` and `deleteAt = expiresAt + 24h` even for open sessions, so untouched expired sessions are eventually removed; derive `expired` on read and set terminal `deleteAt` after a finished move. Reserve `(guildId,creatorId)` with a unique active key, clear expired reservations before new create, and release it on finish. Validate IDs before querying; never return raw document with RPS secrets.
- [ ] **Step 4: Run the same test and `pnpm --filter @sentinel/bot typecheck`; expect both to pass.**
- [ ] **Step 5: Commit persistence and tests with `feat: persist game sessions atomically`.**

### Task 3: API, current membership and game OAuth return

**Files:** Create `apps/bot/src/services/auth/guildMembership.ts`, `apps/bot/src/api/routes/games.ts`, `apps/bot/tests/gameRoutes.test.ts`; modify `apps/bot/src/api/server.ts`, `apps/bot/src/models/AuthState.ts`, `apps/bot/src/services/auth/sessions.ts`, `apps/bot/src/api/routes/auth.ts`, `apps/bot/tests/auth.test.ts`.

**Interfaces:** Produce `authorizeGuildMember(client: Client|undefined,guildId: string,userId: string): Promise<void>` using force-fetched membership. Routes: `POST /api/games` accepts `{guildId,kind}` and creates a game; `GET /api/games/:sessionId` gives viewer-safe projection; `POST /api/games/:sessionId/actions` accepts `GameAction` and returns updated view. Change `createOAuthState(returnPath?: string): Promise<string>` and `consumeOAuthState(value,cookieValue): Promise<{valid:boolean;returnPath:string|null}>`; auth start accepts only an internal `/games/new` or `/games/<valid-session-id>` return path and stores it with OAuth state; callback consumes it once.

- [ ] **Step 1: Write failing route/auth tests.** Assert anonymous GET hides choices; authenticated player GET shows only own pending choice; web create requires a guild bot serves and current membership; mutation without session/Origin/CSRF is 401/403, departed member and wrong guild are 403, malformed action is 400, stale CAS is 409, timeout is 410, and a valid OAuth return path survives callback while an external URL is rejected.
  ```ts
  it('rejects a departed member with a valid session cookie', async () => {
    const response = await postGameAction({ cookie: validCookie, csrf: validCsrf, id });
    expect(response.statusCode).toBe(403);
    expect(actOnGameSession).not.toHaveBeenCalled();
  });
  ```
- [ ] **Step 2: Run `pnpm --filter @sentinel/bot exec vitest run tests/gameRoutes.test.ts tests/auth.test.ts`; expect failures on missing routes/return path.**
- [ ] **Step 3: Implement membership check and routes.** Rate-limit create/action paths at 20 requests per minute per account/IP, force-fetch membership on each write and verify session guild before acting. Reuse `requireSession` and `verifyMutation`; set `Cache-Control: no-store` on session responses. Limit OAuth return path to `/games/new` or `/games/` followed by the game ID format; default callback remains `/dashboard/manage`.
- [ ] **Step 3: Implement membership check and routes.** Rate-limit create/action paths at 20 requests per minute per account/IP, force-fetch membership on each write and verify session guild before acting. Reuse `requireSession` and `verifyMutation`; set `Cache-Control: no-store` on session responses. Use 21-character Nano IDs and allow OAuth return paths only `/games/new` or `/games/[A-Za-z0-9_-]{21}`; default callback remains `/dashboard/manage`.
- [ ] **Step 4: Run the same tests and `pnpm --filter @sentinel/bot typecheck`; expect both to pass.**
- [ ] **Step 5: Commit route/auth changes and tests with `feat: expose authorized game actions`.**

### Task 4: Discord game UI

**Files:** Create `apps/bot/src/commands/gameSessions.ts`, `apps/bot/tests/gameSessionCommands.test.ts`; modify `apps/bot/src/commands/game.ts`, `apps/bot/src/events/ready.ts`, `apps/bot/src/events/interactionCreate.ts`.

**Interfaces:** Produce `handleNewGameCommand(interaction: ChatInputCommandInteraction): Promise<void>`, `handleOpenGameCommand(interaction: ChatInputCommandInteraction): Promise<void>` and `handleGameButton(interaction: ButtonInteraction): Promise<void>` consuming Task 2 service. Component IDs contain only action type, session ID and cell/choice; Discord identity comes only from interaction.

- [ ] **Step 1: Write failing interaction tests.** Assert guild-only creation, visible Join/web link, 3×3 nine-cell button grid, X/O turn lock, expired game explanation, outsider action denial, RPS selection via ephemeral controls/confirmation, hidden choice in public message, and final public result. `/game open id:<sessionId>` attaches a web-created game only in its guild, by a player, and returns the existing message link when already attached. A failed message edit leaves the Mongo session valid and tells the actor where to continue.
  ```ts
  it('does not reveal the first RPS choice in the channel message', async () => {
    await handleGameButton(aliceChoiceInteraction);
    expect(publicMessage.edit).not.toHaveBeenCalledWith(expect.stringContaining('rock'));
    expect(aliceChoiceInteraction.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });
  ```
- [ ] **Step 2: Run `pnpm --filter @sentinel/bot exec vitest run tests/gameSessionCommands.test.ts`; expect failure because handlers are absent.**
- [ ] **Step 3: Implement handlers and register `/game tictactoe`, `/game rps` and `/game open`.** Defer interactions within Discord's deadline; create/edit the game message via stored channel/message ID where available. Disable terminal-state buttons, encode web URL using `FRONTEND_URL`, guard button custom ID length and old-session clicks.
- [ ] **Step 4: Run the same test and `pnpm --filter @sentinel/bot typecheck`; expect both to pass.**
- [ ] **Step 5: Commit handlers and tests with `feat: play shared games in Discord`.**

### Task 5: Web game screen and product documentation

**Files:** Create `apps/web/src/views/GameView.vue`, `apps/web/tests/gameView.test.ts`; modify `apps/web/src/api.ts`, `apps/web/src/router/index.ts`, `apps/web/src/content/commands.ts`, `README.md`, `apps/web/src/views/PrivacyView.vue`, `docs/discord-developer-portal.md`, and SEO route assertions where needed.

**Interfaces:** `GET` and `POST` client helpers consume Task 3 routes; routes are `/games/new` and `/games/:sessionId`. Web OAuth start receives only these relative paths. Render Task 1 `GameSessionView` without accessing raw model fields.

- [ ] **Step 1: Write failing web tests.** Assert logged-in user can select a guild from `/api/guilds` and create either game, login button preserves new/existing game URL, join/move POST includes credentials and CSRF, 401/403/409/410 have distinct UI, spectator has no action controls, RPS opponent choice remains hidden, and polling runs every 5 seconds only while visible and active. Assert game view remains usable at narrow width and buttons have accessible labels.
  ```ts
  it('submits a move with the logged-in session and CSRF token', async () => {
    await wrapper.get('[aria-label="Đánh ô 1"]').trigger('click');
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining('/api/games/'),
      expect.objectContaining({ credentials: 'include', method: 'POST' }));
  });
  ```
- [ ] **Step 2: Run `pnpm --filter @sentinel/web exec vitest run tests/gameView.test.ts`; expect failure because view is absent.**
- [ ] **Step 3: Implement responsive screen and API helpers.** New-game screen selects one of the bot's guilds, validates membership at API create, and shows the resulting link plus `/game open id:<sessionId>` to copy. Stop timer on hidden/unmount/terminal game; reload after successful action or conflict. Update README, command page, Privacy Policy (24-hour session retention), Portal guide (no Activity or HTTP interactions endpoint), and landing links only for shipped games.
- [ ] **Step 4: Run web test, `pnpm -r test`, `pnpm -r typecheck`, `pnpm -r build`, and `pnpm --filter @sentinel/web verify:seo`; expect all exit 0.**
- [ ] **Step 5: Commit web, docs and tests with `feat: play shared games on the web`.**

### Task 6: Integrated release and live checks

**Files:** Modify documentation only if live behavior differs; write VPS commands and observed results to ignored `.diagnostics/shared-games-deploy-commands.md`.

**Interfaces:** Uses the completed commands, API and web routes from Tasks 1–5 and the utility-command plan. No new runtime interface.

- [ ] **Step 1: Run `pnpm -r test`, `pnpm -r typecheck`, `pnpm -r build`, and `pnpm --filter @sentinel/web verify:seo` on the exact release commit; record exit status for each.**
- [ ] **Step 2: Review the branch against the approved spec and both plans; fix concrete findings, rerun affected checks, then push and create a PR linked to the GitHub Issue.**
- [ ] **Step 3: Wait for required GitHub checks, merge the PR into `main`, and deploy API/bot and web using the repo's existing release path. Log every VPS command in `.diagnostics/shared-games-deploy-commands.md` before or immediately after execution.**
- [ ] **Step 4: Smoke-test production `/api/health`, `/commands`, `/privacy`, OAuth game return, web-created game opened in Discord, Discord-created game continued on web, `/remind` DM and `/serverstats`; record observed behavior and fix any mismatch before claiming completion.**
- [ ] **Step 5: Close linked issues only after the live checks pass and summarize exactly which Developer Portal fields, if any, the owner must change.**
