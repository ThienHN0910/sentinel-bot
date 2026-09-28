/**
 * apps/bot/src/index.ts — Master Bootstrap
 *
 * Startup sequence:
 *  1. Load environment variables (dotenv)
 *  2. Connect to MongoDB
 *  3. Start GovernorManager (CPU/memory monitoring)
 *  4. Start Fastify API server
 *  5. Create Discord.js Client & register event handlers
 *  6. Login to Discord
 *  7. Start ReminderService polling
 *
 * Graceful shutdown:
 *  - SIGTERM / SIGINT: close Fastify, disconnect voice connections, close DB, destroy Discord client
 */
import 'dotenv/config';

import mongoose from 'mongoose';
import { Client, GatewayIntentBits } from 'discord.js';

import { connectDatabase } from './models/database.js';
import { GovernorManager } from './governor/GovernorManager.js';
import { buildFastifyServer } from './api/server.js';
import { ReminderService } from './services/reminder/ReminderService.js';
import { scheduleWeeklyReports } from './services/analytics/WeeklyReportCron.js';

import { onReady } from './events/ready.js';
import { onMessageCreate } from './events/messageCreate.js';
import { onVoiceStateUpdate } from './events/voiceStateUpdate.js';
import { onInteractionCreate } from './events/interactionCreate.js';
import { reconcileVoiceSessions, startVoiceObservation } from './services/voice/voiceReconciliation.js';

// ── Validate required environment variables ──────────────────────────────────
const REQUIRED_ENV = ['DISCORD_TOKEN', 'MONGODB_URI'] as const;
for (const key of REQUIRED_ENV) {
  if (!process.env[key]) {
    console.error(`[Bootstrap] Missing required environment variable: ${key}`);
    process.exit(1);
  }
}

const DISCORD_TOKEN = process.env.DISCORD_TOKEN as string;
const MONGODB_URI   = process.env.MONGODB_URI as string;
const PORT          = Number(process.env.PORT) || 3000;

// ── Discord Client ────────────────────────────────────────────────────────────
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers
  ]
});

// ── Fastify server (module-scoped so shutdown() can close it) ────────────────
let server: Awaited<ReturnType<typeof buildFastifyServer>>;
let stopVoiceObservation: (() => void) | undefined;
let voiceRetryTimer: ReturnType<typeof setTimeout> | undefined;
let weeklyReportTask: { stop(): void } | undefined;

// ── Governor ─────────────────────────────────────────────────────────────────
const governor = new GovernorManager();

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  console.log(`[Bootstrap] Received ${signal} — shutting down gracefully...`);

  // 1. Close Fastify (drains in-flight HTTP requests)
  try {
    await server.close();
    console.log('[Bootstrap] Fastify server closed.');
  } catch (err) {
    console.error('[Bootstrap] Error closing Fastify server:', err);
  }

  // 2. Stop reminder polling
  ReminderService.stopPolling();
  weeklyReportTask?.stop();
  stopVoiceObservation?.();
  if (voiceRetryTimer) clearTimeout(voiceRetryTimer);

  // 3. Stop the governor worker
  governor.stop();

  // 4. Destroy Discord client (disconnects all voice channels)
  client.destroy();
  console.log('[Bootstrap] Discord client destroyed.');

  // 5. Close MongoDB connection
  try {
    await mongoose.connection.close();
    console.log('[Bootstrap] MongoDB connection closed.');
  } catch (err) {
    console.error('[Bootstrap] Error closing MongoDB connection:', err);
  }

  process.exit(0);
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT',  () => shutdown('SIGINT'));

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function bootstrap(): Promise<void> {
  // 1. MongoDB
  console.log('[Bootstrap] Connecting to MongoDB...');
  await connectDatabase(MONGODB_URI);
  console.log('[Bootstrap] MongoDB connected.');

  // 2. Governor
  governor.start();
  console.log('[Bootstrap] GovernorManager started.');

  // 3. Fastify API
  server = buildFastifyServer(client, governor);
  await server.listen({ port: PORT, host: '0.0.0.0' });
  console.log(`[Bootstrap] Fastify API listening on port ${PORT}.`);

  // 4. Discord event handlers
  client.once('ready', (c) => {
    weeklyReportTask ??= scheduleWeeklyReports(c);
    const initializeVoice = async () => {
      try {
        await reconcileVoiceSessions(c);
        stopVoiceObservation ??= startVoiceObservation(c);
      } catch (error) {
        console.error('[Voice] Startup reconciliation failed; retrying:', error);
        voiceRetryTimer = setTimeout(() => { void initializeVoice(); }, 30_000);
        voiceRetryTimer.unref();
      }
    };
    void initializeVoice();
    void onReady(c).catch(console.error);
  });
  client.on('messageCreate',    (msg)              => { onMessageCreate(msg).catch(console.error); });
  client.on('voiceStateUpdate', (oldState, newState) => { onVoiceStateUpdate(oldState, newState).catch(console.error); });
  client.on('interactionCreate',(interaction)      => { onInteractionCreate(interaction).catch(console.error); });

  // 5. Login
  console.log('[Bootstrap] Logging in to Discord...');
  await client.login(DISCORD_TOKEN);

  // 6. Start reminder polling (every 30 s)
  ReminderService.startPolling(client, 30_000);
  console.log('[Bootstrap] ReminderService polling started.');
}

bootstrap().catch((err) => {
  console.error('[Bootstrap] Fatal startup error:', err);
  process.exit(1);
});
