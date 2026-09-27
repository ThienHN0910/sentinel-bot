# Voice Analytics and Essential Statistics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve observed voice time across bot restarts and expose accurate voice and chat statistics in the dashboard and Discord commands.

**Architecture:** A MongoDB `VoiceSession` record is the durable source for each active connection; `UserStat` keeps completed lifetime totals. A single read service combines completed and active time for API and commands. The dashboard caches aggregate data briefly and overlays fresh current-voice values.

**Tech Stack:** Node.js 20, TypeScript, discord.js 14, Mongoose 8, Fastify 4, Vue 3, Vitest, pnpm 9.

**Spec:** `docs/superpowers/specs/2026-09-27-voice-analytics-design.md`

## Global Constraints

- Do not infer unobserved voice time during an outage or before first observation.
- Preserve existing `UserStat` totals, `/random`, `/game`, and TTS greeting behavior.
- Personal XP and coin balances appear only in private command responses.
- Do not store full message text or voice audio.
- Public leaderboard responses contain only rank, user ID, username, avatar, and score.
- Add no product dependency unless an existing package cannot provide the required behavior.

## Review Focus

- A user disconnects and reconnects while the bot is offline: cap the old session at `lastObservedAt`; begin the new observed session at startup.
- Duplicate leave events or a transaction retry: completed seconds and rewards change once.
- A voice-state update arrives while startup reconciliation runs: serialize updates per guild/user so reconciliation cannot overwrite the newer state.
- Dashboard cache expires during simultaneous requests: one aggregate query per guild refresh, and failures do not cache empty data.
- Discord command query exceeds the interaction response window: defer first, then edit the private reply or send a short error.

---

### Task 1: Persistent voice-session model and read math

**Files:** Create `apps/bot/src/models/VoiceSession.ts`, `apps/bot/src/services/voice/voiceStats.ts`, `apps/bot/tests/voiceStats.test.ts`; modify `apps/bot/src/models/index.ts` only if the barrel is used.

**Interfaces:** Produce `VoiceSessionModel` with unique `(guildId,userId)` and `channelId`, `startedAt`, `lastObservedAt`; `getActiveVoiceSeconds(session, now): number`; `getUserVoiceSeconds(completed, session, now): { completedSeconds: number; activeEstimatedSeconds: number; totalEstimatedSeconds: number }`.

- [ ] Add failing tests: a 600-second active session yields 600 estimated seconds; a future start yields zero; completed 300 plus active 600 yields 900; model rejects missing keys and has a unique compound index.
- [ ] Run `pnpm --filter @sentinel/bot test -- voiceStats.test.ts`; verify the new tests fail for missing interfaces.
- [ ] Implement the model and pure read helpers; clamp negative durations and use whole seconds.
- [ ] Rerun the focused test and `pnpm --filter @sentinel/bot typecheck`; require both to pass.
- [ ] Commit the model, helper, and tests.

### Task 2: Durable voice lifecycle and reconciliation

**Files:** Modify `apps/bot/src/services/voice/VoiceService.ts`, `apps/bot/src/events/ready.ts`, `apps/bot/src/index.ts`, `apps/bot/tests/voice.test.ts`; create `apps/bot/src/services/voice/voiceReconciliation.ts` and `apps/bot/tests/voiceReconciliation.test.ts`.

**Interfaces:** Consume `VoiceSessionModel` and Task 1 math. Produce `VoiceService.handleVoiceStateUpdate(oldState,newState)`, `reconcileVoiceSessions(client, now)`, and `startVoiceObservation(client, intervalMs=60_000): () => void`. Keep shutdown cleanup in `index.ts`.

- [ ] Add failing tests for join persistence, channel move, duplicate join/leave, bot exclusion, a normal leave that atomically increments `UserStat` and removes its session, and transaction failure that retains the session.
- [ ] Add failing reconciliation tests for still connected, absent, and newly seen members; absent sessions settle through `lastObservedAt`, never through restart time. Include a race test with a voice event during reconciliation.
- [ ] Run `pnpm --filter @sentinel/bot test -- voice.test.ts voiceReconciliation.test.ts`; confirm behavior failures.
- [ ] Implement serialized per-user lifecycle actions, transaction settlement, ready-time reconciliation, and bounded 60-second `lastObservedAt` refresh. On save failure log and retry; do not remove the durable session. Keep TTS on actual new joins only.
- [ ] Rerun focused tests and bot typecheck; require all to pass. Commit.

### Task 3: Voice and chat API, bounded dashboard reads

**Files:** Modify `apps/bot/src/api/routes/dashboard.ts`, `apps/bot/src/api/routes/leaderboard.ts`, `apps/bot/tests/dashboard.test.ts`, `apps/bot/tests/api.test.ts`; create `apps/bot/src/services/analytics/dashboardSnapshot.ts` if route logic would otherwise grow.

**Interfaces:** Consume Task 1 voice math. Dashboard returns `stats.voiceCompletedSeconds`, `stats.voiceActiveEstimatedSeconds`, `stats.voiceTotalEstimatedSeconds`, `topVoice` (up to 10), and `activity.messagesMatrix` / `activity.voiceJoinsMatrix` with shared `days`; retain existing member, voice-now, and message fields. Public leaderboard DTO is limited to identity and score.

- [ ] Add failing API tests for one completed and one active voice user, separate activity matrices, no balance fields in public leaderboard, empty guild data, and cache sharing across concurrent requests.
- [ ] Run `pnpm --filter @sentinel/bot test -- dashboard.test.ts api.test.ts`; confirm the assertions fail.
- [ ] Implement one per-guild snapshot promise with a maximum 30-second TTL; overlay current `voiceNow`, active duration, and `updatedAt` on each response. Reject unknown guilds and avoid caching failed queries. Limit leaderboard reads to ten.
- [ ] Rerun focused tests and bot typecheck; require all to pass. Commit.

### Task 4: Dashboard presentation

**Files:** Modify `apps/web/src/utils/dashboardData.ts`, `apps/web/src/views/DashboardView.vue`, `apps/web/src/components/ActivityHeatmap.vue`, `apps/web/tests/dashboardData.test.ts`.

**Interfaces:** Consume Task 3 DTO. Produce `formatVoiceDuration(seconds): string`; show all-time message and voice totals, active estimate label, voice top list, and separate seven-day message and voice-join heatmaps.

- [ ] Add failing utility tests for 0, 59, 60, and 3660 seconds and for mapping separate message/voice-join matrices without combining them.
- [ ] Run `pnpm --filter @sentinel/web test -- dashboardData.test.ts`; confirm failure.
- [ ] Implement the UI, preserving 30-second refresh and server selection. Show an explicit empty state for voice top.
- [ ] Run web focused tests, typecheck, and build; require all to pass. Commit.

### Task 5: Read-only Discord statistics commands

**Files:** Create `apps/bot/src/commands/stats.ts`, `apps/bot/src/commands/leaderboard.ts`, `apps/bot/src/commands/help.ts`, `apps/bot/tests/statsCommands.test.ts`; modify `apps/bot/src/events/ready.ts`, `apps/bot/src/events/interactionCreate.ts`, `apps/web/src/views/CommandsView.vue`.

**Interfaces:** Consume Task 1 voice math and existing `UserStatModel`. Register `/stats`, `/leaderboard type:chat|voice`, and `/help`; reject DMs for guild statistics. `/stats` and failures are private; leaderboard has at most ten entries and no balance fields.

- [ ] Add failing handler tests for an absent user, an active session, chat/voice sorting and fixed limit, DM rejection, query failure, and a slow query that has been deferred before reading MongoDB.
- [ ] Run `pnpm --filter @sentinel/bot test -- statsCommands.test.ts`; confirm failure.
- [ ] Implement handlers and command registration; use one shared command-definition list for `/help` and Discord registration to prevent drift. Use `deferReply({ ephemeral: true })` for personal stats and bounded database reads.
- [ ] Rerun focused tests, bot typecheck, and build; require all to pass. Commit command code and the updated command guide together.

### Task 6: Limit word processing and verify the release

**Files:** Modify `apps/bot/src/services/analytics/AnalyticsService.ts`, `apps/bot/tests/analytics.test.ts`; update `.diagnostics/` ignored command log only when accessing the VPS.

**Interfaces:** Cap word processing at 50 accepted tokens per message, aggregate repeated tokens into one bulk operation per distinct word, and leave `totalMessages` counting unchanged.

- [ ] Add failing tests for a 100-token message (only first 50 accepted tokens counted) and repeated words (one bulk operation with matching increment); keep the existing bot/DM exclusion tests.
- [ ] Run `pnpm --filter @sentinel/bot test -- analytics.test.ts`; confirm the new assertions fail.
- [ ] Implement the bounded word updates and run focused tests, then `pnpm -r test`, `pnpm -r typecheck`, and `pnpm -r build`; require passing output. Commit.
- [ ] Inspect MongoDB query plans and only add an index if measured reads justify its write cost; record the result in the deployment log.
- [ ] Deploy bot/API before web using the established workflow; log VPS commands to `.diagnostics/` before execution. Verify `/api/health`, both guild dashboards, distinct activity fields, dashboard rendering, and slash-command registration; report observed values without implying any historical backfill.
