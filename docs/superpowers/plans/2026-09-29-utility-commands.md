# Utility Commands Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/remind` with private DM delivery and `/serverstats` with truthful cumulative server metrics.

**Architecture:** Keep Discord command handlers thin. `ReminderService` owns validation, persistence and delivery; `ServerStatsService` owns bounded aggregation and short caching. Register commands through the existing Gateway command router.

**Tech Stack:** TypeScript, discord.js 14, MongoDB/Mongoose, Vitest, pnpm 9.7.0.

**Spec:** `docs/superpowers/specs/2026-09-29-cross-platform-games-and-utility-commands-design.md`

## Global Constraints

- `/remind set` accepts `1m` through `7d`, text length 1–200, at most 10 pending reminders per user across guilds; DM only.
- `/remind list` shows at most 10 pending and 5 recent failed; completed/cancelled/failed records expire after 7 days.
- `/serverstats` labels message totals as cumulative since observation, completed voice separately from active estimated voice; never claims a seven-day window.
- Commands are guild-only except that reminder delivery goes to the user's DM. No new privileged intent, reward, bet or secret in source control.

## Review Focus

1. An invalid duration such as `0m`, `8d`, whitespace or overflow is rejected without storing a reminder (Task 2 test).
2. A closed DM records `failed` without exposing message content in a server channel or log (Task 1 test).
3. Two pollers claiming the same due reminder cause at most one send attempt (Task 1 test).
4. A reminder belonging to another user cannot be cancelled (Task 2 test).
5. A database failure in `/serverstats` reports an error instead of showing fabricated zero totals (Task 3 test).

---

## File map

- `packages/shared/src/types/index.ts`: reminder status and public reminder shape shared with the model.
- `apps/bot/src/models/Reminder.ts`: reminder schema, owner/due/status indexes and 7-day expiry for terminal records.
- `apps/bot/src/services/reminder/ReminderService.ts`: parse/create/list/cancel/claim/send lifecycle; remove legacy channel-send behavior.
- `apps/bot/src/commands/remind.ts`: slash command adapter and private replies.
- `apps/bot/src/services/analytics/ServerStatsService.ts`: guild snapshot aggregation, active voice estimate and cache.
- `apps/bot/src/commands/serverstats.ts`: embed and link adapter.
- `apps/web/src/views/DashboardView.vue`: honor a validated `?guild=` selector from the serverstats link.
- `apps/bot/src/events/ready.ts`, `apps/bot/src/events/interactionCreate.ts`: command registration and routing.
- `apps/bot/tests/reminderCommands.test.ts`, `apps/bot/tests/serverStatsCommand.test.ts`: behavior tests; update legacy reminder tests in `economy.test.ts`.
- `README.md`, `apps/web/src/content/commands.ts`, `docs/discord-developer-portal.md`, `apps/web/src/views/PrivacyView.vue`: user-visible truth and retention.

### Task 1: Reliable private reminder lifecycle

**Files:** Modify `packages/shared/src/types/index.ts`, `apps/bot/src/models/Reminder.ts`, `apps/bot/src/services/reminder/ReminderService.ts`, `apps/bot/tests/economy.test.ts`; create `apps/bot/tests/reminderService.test.ts`.

**Interfaces:** Produce `parseReminderDelay(input: string): number` (milliseconds or validation error), `ReminderService.createReminder({userId,guildId,message,remindAt}): Promise<ReminderDocument>`, `listReminders(userId): Promise<{pending: ReminderDocument[]; failed: ReminderDocument[]}>`, `cancelReminder(userId, publicId): Promise<boolean>`, and `pollReminders(client): Promise<number>`. Keep `startPolling`/`stopPolling` callable from `index.ts`.

- [ ] **Step 1: Write failing lifecycle tests.** Assert atomic `findOneAndUpdate` claim allows one of two pollers to send; successful `client.users.fetch(userId).send` marks completed after send; rejected DM marks failed, does not call `client.channels.fetch`, and does not log `message`; terminal expiry is 7 days. Assert two concurrent creates cannot allocate an eleventh pending slot. Replace the legacy channel delivery assertions in `economy.test.ts`.
- [ ] **Step 2: Run `pnpm --filter @sentinel/bot exec vitest run tests/reminderService.test.ts tests/economy.test.ts`; expect the new tests to fail on current channel delivery.**
- [ ] **Step 3: Implement schema and service.** Add 12-character public ID with unique index; status `pending|sending|completed|failed|cancelled`, claim timestamp, attempt count and terminal `deleteAt` TTL index. Allocate pending slot 0–9 with a unique partial index on `(userId,slot)` for active statuses so concurrent creates respect the cap. Claim due work one document at a time with `findOneAndUpdate`; recover expired claims with a bounded attempt count; mark completion only after DM success. Preserve 30-second poll startup and stop behavior, but prevent overlap in a single process.
- [ ] **Step 4: Run the same Vitest command; expect all tests to pass.**
- [ ] **Step 5: Commit model, service and tests with `fix: deliver reminders privately and reliably`.**

### Task 2: `/remind` command

**Files:** Create `apps/bot/src/commands/remind.ts`, `apps/bot/tests/reminderCommands.test.ts`; modify `apps/bot/src/events/ready.ts`, `apps/bot/src/events/interactionCreate.ts`.

**Interfaces:** Consume Task 1 service. Produce `handleRemindCommand(interaction: ChatInputCommandInteraction): Promise<void>` with `set`, `list`, `cancel`; all replies ephemeral. `set` options are `in` and `text`; `cancel` option is `id`.

- [ ] **Step 1: Write failing command tests.** Assert `1m` and `7d` accepted; `0m`, `8d`, malformed and overflow durations rejected; 201-character text and 11th pending reminder rejected; `list` returns at most 10 pending and 5 failed; other user's `id` cannot be cancelled; no public reply contains reminder text.
- [ ] **Step 2: Run `pnpm --filter @sentinel/bot exec vitest run tests/reminderCommands.test.ts`; expect failure because the command is absent.**
- [ ] **Step 3: Implement handler and register global slash command.** Use Discord timestamps in `list`, clear closed-DM warning on create, 8-second query timeout for database work and private errors. Route three subcommands in `interactionCreate.ts`.
- [ ] **Step 4: Run the same test, then `pnpm --filter @sentinel/bot typecheck`; expect both to pass.**
- [ ] **Step 5: Commit handler, registration and tests with `feat: add private reminder commands`.**

### Task 3: `/serverstats` snapshot

**Files:** Create `apps/bot/src/services/analytics/ServerStatsService.ts`, `apps/bot/src/commands/serverstats.ts`, `apps/bot/tests/serverStatsCommand.test.ts`, `apps/web/tests/dashboardView.test.ts`; modify `apps/bot/src/events/ready.ts`, `apps/bot/src/events/interactionCreate.ts`, `apps/web/src/views/DashboardView.vue`.

**Interfaces:** Produce `getServerStats(guild: Guild, now?: Date): Promise<{members:number; messages:number; voiceCompletedSeconds:number; voiceActiveEstimatedSeconds:number; updatedAt:string}>` and `handleServerStatsCommand(interaction: ChatInputCommandInteraction): Promise<void>`.

- [ ] **Step 1: Write failing tests.** Aggregate `UserStat.totalMessages` and `totalVoiceSeconds` for one guild; include only currently connected `VoiceSession` users in estimated active seconds; use `guild.memberCount`; a second request within 30 seconds uses cached snapshot; a different guild gets different data; MongoDB rejection produces private error rather than zero metrics. In web tests, a `?guild=` ID present in `/api/guilds` wins over localStorage and an unknown ID does not.
- [ ] **Step 2: Run `pnpm --filter @sentinel/bot exec vitest run tests/serverStatsCommand.test.ts` and `pnpm --filter @sentinel/web exec vitest run tests/dashboardView.test.ts`; expect both to fail because the service and query handling are absent.**
- [ ] **Step 3: Implement service and command.** Use indexed guild aggregate and limit active session reads to current voice-state user IDs, reuse `getActiveVoiceSeconds`, format Vietnamese duration and link `/dashboard?guild=<guildId>`. Make DashboardView honor that query after validating it against fetched guilds. Register `/serverstats` as guild-only with a clear cumulative label.
- [ ] **Step 4: Run the bot test, `pnpm --filter @sentinel/web exec vitest run tests/dashboardView.test.ts`, and `pnpm --filter @sentinel/bot typecheck`; expect all to pass.**
- [ ] **Step 5: Commit service, handler and tests with `feat: show cumulative server statistics`.**

### Task 4: User documentation and release verification

**Files:** Modify `README.md`, `apps/web/src/content/commands.ts`, `docs/discord-developer-portal.md`, `apps/web/src/views/PrivacyView.vue`, and existing command/page tests only where behavior assertions change.

**Interfaces:** No new runtime interface. Document exactly the command names and options registered in Tasks 2–3.

- [ ] **Step 1: Compare registered commands with README, web command content, Privacy Policy and Portal guide; record the exact stale statements in this task's commit message.**
- [ ] **Step 2: Update docs and content.** Include `/remind set|list|cancel` and `/serverstats`; state DM reminder data and 7-day terminal retention; say no new Activity or Interactions Endpoint URL setting. `/help` automatically lists top-level commands from registration. Preserve accurate old commands and avoid claiming new games are available until the game plan lands.
- [ ] **Step 3: Verify with `rg -n '/remind|/serverstats|7 ngày|Interactions Endpoint' README.md apps/web/src/content/commands.ts apps/web/src/views/PrivacyView.vue docs/discord-developer-portal.md`; expect matching user-facing copy in the relevant files.**
- [ ] **Step 4: Run `pnpm -r test`, `pnpm -r typecheck`, `pnpm -r build`, then `pnpm --filter @sentinel/web verify:seo`; expect all exit 0.**
- [ ] **Step 5: Commit docs and verification-related tests with `docs: explain reminders and server statistics`.**
