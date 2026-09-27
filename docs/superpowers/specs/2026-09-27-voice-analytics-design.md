# Sentinel voice analytics and essential statistics

Date: 2026-09-27

## Intent and scope

Make the bot's reported voice time match actual observed participation, show the data already collected on the live dashboard, and let members inspect their own statistics through Discord. Keep database work bounded as server count and dashboard traffic grow. This iteration covers tracking, dashboard, and essential read-only commands. New games and economy commands follow only after the statistics are trustworthy.

## Current behavior and cause

Chat messages are counted in `UserStat.totalMessages` and hourly `ActivityBucket.messages`. Voice duration is counted only when a user leaves, while the start time exists only in a process-local map. A restart discards that map. The dashboard reads `totalMessages` but not `totalVoiceSeconds`; its heatmap combines message counts and voice joins. The live API currently has five users in voice in one server but zero recorded voice seconds. That observation alone does not establish how long those users have been connected.

## Approach

Use a small persistent voice-session collection and the existing cumulative `UserStat` collection. A session is keyed uniquely by guild and user and stores its channel, start time, and last observed time. At startup, reconcile saved sessions with the Discord voice-state cache after the client is ready. Keep a session for a member still in voice. Close a session for a member no longer present using its last observed time; never infer unobserved time during an outage. Start a new session for an already-connected member without a saved session at reconciliation time. Channel moves retain the session. A bot user is never tracked.

On a normal leave, atomically add the completed session's duration and rewards to `UserStat` and remove the session in a MongoDB transaction. On a restart, do the same with the last observed time for orphaned sessions. Periodically update the last observed time of active sessions in bounded batches; a failure must be logged and retried without deleting a session. The dashboard and `/stats` calculate current voice time as completed seconds plus the elapsed time of an active session. They label it as an estimate until the session closes. A repeated join/leave event must not double count. If the database is unavailable, the bot must report the failure and avoid claiming that an uncommitted duration was saved.

The dashboard API returns total completed voice seconds, current estimated voice seconds, and a voice top list, alongside the existing message totals. It exposes separate hourly message and voice-join activity rather than presenting their sum as one unnamed activity count. These counters are all-time except for the seven-day hourly chart. The UI names those windows explicitly and formats seconds into hours/minutes. It keeps its current guild selector and 30-second refresh.

Add `/stats` for the caller's chat count, completed voice time, current estimated voice time, XP, and coins; `/leaderboard` with `chat` or `voice`; and `/help` listing only commands actually registered. Responses for personal stats are private to the caller. Leaderboards use a fixed top-ten limit. `/serverstats` can follow when seven-day voice-duration buckets exist; this iteration must not label all-time voice totals as seven-day data. `/settings`, quiz, and rock-paper-scissors are deferred until the first release is verified.

## Load and privacy

Cache each guild dashboard response for a short interval of at most 30 seconds, while retaining a fresh `voiceNow` count and response timestamp. Avoid repeated full aggregation per viewer. Bound word-cloud processing per message and retain the existing 60-day word expiry. Measure read and write load before adding indexes; index changes must be justified by query plans. Do not store full message text or voice audio. The public dashboard continues to show only aggregates and the existing leaderboard identity fields; personal balances remain accessible only through a private command response.

## Failure and edge cases

- Track join, leave, channel move, duplicate event, and bot events separately.
- A restart while a member remains in voice preserves the recorded start time. A restart after a member left during downtime closes only through the last observed time.
- Never backfill time before the bot first observed a member. Existing lifetime totals remain unchanged.
- If a user has no record, `/stats` returns zero values and explains that collection begins when the bot observes activity.
- Avoid granting voice rewards twice when reconciliation or events are retried.
- Keep the Discord command handler responsive if a MongoDB query is slow or unavailable; return a short error response.

## Verification

Use focused tests for voice-session reconciliation and idempotent settlement, API totals and distinct activity series, and command replies including empty data and errors. Run the bot/web test suites, type checks, and builds. Verify the deployed API's schema and dashboard rendering against a real guild after deployment. Do not claim historical voice time was recovered where Discord supplied no observation.

## Deployment

Ship bot and web changes together, with the bot/API first so the dashboard has its required fields. Existing user totals and command behavior are preserved. Check live health and both server dashboards after deployment. Record any VPS commands in the existing ignored `.diagnostics/` command log before running them.
