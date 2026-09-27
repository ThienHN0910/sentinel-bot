# Sentinel Bot & Cyber Web Dashboard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a production-grade Discord bot with Node.js/TypeScript running on an Oracle Cloud Free Tier VPS (featuring an autonomous adaptive CPU governor maintaining 22%–27% CPU load and bounded 1GB RAM memory profile) connected to MongoDB Atlas `DNE_BotDiscord`, with voice/chat tracking, TTS greetings, NLP analytics, leveling/economy, reminders, mini-games, and a high-aesthetic Vue 3 web dashboard with a real-time synchronized 3D physics wheel.

**Architecture:** pnpm monorepo containing `apps/bot` (Discord.js v14 + Fastify API + Worker Thread CPU Governor + Voice TTS), `apps/web` (Vue 3 + Vite + Tailwind CSS + GSAP + HTML5 Canvas physics wheel), and `packages/shared` (TypeScript interfaces, DTOs, and constants).

**Tech Stack:** Node.js 20 LTS, TypeScript, Discord.js v14, @discordjs/voice, Fastify, Mongoose, Vue 3, Pinia, Tailwind CSS, GSAP, Canvas Confetti, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-27-sentinel-bot-design.md`

## Global Constraints
- Target VPS: 1 vCPU (AMD E2.1.Micro) and 1 GB RAM on Oracle Cloud Free Tier.
- CPU Governor: Must keep host CPU strictly between 22%–27% using dynamic duty-cycle in a Worker Thread without starving event loop.
- Memory: Node process must run with `--max-old-space-size=400` and peak RSS <= 250MB.
- Database: MongoDB Atlas free tier, database name `DNE_BotDiscord`.
- Security: Zero hardcoded tokens or secrets. All secrets in `.env` with a sanitized `.env.example`.
- Frontend animations: 100% GPU-accelerated (`transform: translate3d(...)`, `opacity`, `scale`).

---

### Task 1: Monorepo Scaffolding & Shared Package (`packages/shared`)

**Files:**
- Create: `pnpm-workspace.yaml`
- Create: `package.json`
- Create: `tsconfig.base.json`
- Create: `.env.example`
- Create: `packages/shared/package.json`
- Create: `packages/shared/tsconfig.json`
- Create: `packages/shared/src/types/index.ts`
- Create: `packages/shared/src/constants/index.ts`
- Create: `packages/shared/src/index.ts`
- Test: `packages/shared/tests/constants.test.ts`

**Interfaces:**
- Consumes: None (root baseline)
- Produces: `IUserStat`, `IGuildConfig`, `IWordStat`, `IReminder`, `IWheelSession`, `WheelEventPayload`, `XP_TABLE`, `STOP_WORDS`

- [ ] **Step 1: Write the failing test for shared types and constants**

Create `packages/shared/tests/constants.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateLevel, calculateRequiredExp, STOP_WORDS } from '../src';

describe('Shared Package Constants & Formulas', () => {
  it('calculates required EXP correctly based on formula 100 * level^1.5', () => {
    expect(calculateRequiredExp(1)).toBe(100);
    expect(calculateRequiredExp(2)).toBe(282); // Math.floor(100 * 2^1.5) = 282
  });

  it('determines user level from cumulative EXP correctly', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(100)).toBe(1);
    expect(calculateLevel(282)).toBe(2);
  });

  it('contains essential Vietnamese and English stop-words', () => {
    expect(STOP_WORDS.has('là')).toBe(true);
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('và')).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/shared test`
Expected: FAIL with "Cannot find module '../src' or package not configured"

- [ ] **Step 3: Write root configuration, workspace files, and shared package implementation**

Create `pnpm-workspace.yaml`:
```yaml
packages:
  - 'packages/*'
  - 'apps/*'
```

Create root `package.json`:
```json
{
  "name": "sentinel-bot-monorepo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "pnpm -r run build",
    "test": "pnpm -r run test",
    "typecheck": "pnpm -r run typecheck"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  },
  "packageManager": "pnpm@9.7.0"
}
```

Create `tsconfig.base.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

Create `.env.example`:
```bash
# Discord Bot Credentials
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here

# MongoDB Atlas
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/DNE_BotDiscord?retryWrites=true&w=majority

# API Server
PORT=3000
JWT_SECRET=super_secret_jwt_key_at_least_32_characters_long
FRONTEND_URL=https://your-dne-bot.vercel.app

# Frontend Config
VITE_API_URL=http://localhost:3000
VITE_WS_URL=ws://localhost:3000
```

Create `packages/shared/package.json`:
```json
{
  "name": "@sentinel/shared",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc -b",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

Create `packages/shared/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

Create `packages/shared/src/types/index.ts`:
```typescript
export interface IUserStat {
  guildId: string;
  userId: string;
  username: string;
  avatar: string;
  totalVoiceSeconds: number;
  totalMessages: number;
  totalImages: number;
  exp: number;
  level: number;
  dneCoins: number;
  dailyStreak: number;
  lastDailyAt?: Date;
  mentionedUsers: Record<string, number>;
  updatedAt: Date;
}

export interface IGuildConfig {
  guildId: string;
  name: string;
  welcomeVoiceTts: boolean;
  welcomeMessage: string;
  reportChannelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IWordStat {
  guildId: string;
  word: string;
  count: number;
  lastSeenAt: Date;
}

export interface IReminder {
  id?: string;
  userId: string;
  guildId: string;
  channelId: string;
  message: string;
  remindAt: Date;
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
}

export interface IWheelItem {
  id: string;
  label: string;
  color: string;
  weight?: number;
}

export interface IWheelSession {
  sessionId: string;
  guildId: string;
  createdBy: string;
  title: string;
  items: IWheelItem[];
  winner?: string;
  isCompleted: boolean;
  createdAt: Date;
}

export type WheelSocketEvent =
  | { event: 'SPIN_START'; targetIndex: number; targetAngle: number; durationMs: number; startedAt: number }
  | { event: 'SPIN_END'; winner: string; targetIndex: number }
  | { event: 'STATE_SYNC'; session: IWheelSession };
```

Create `packages/shared/src/constants/index.ts`:
```typescript
export const STOP_WORDS = new Set([
  'là', 'và', 'của', 'có', 'được', 'cho', 'với', 'trong', 'đã', 'sẽ', 'thì',
  'mà', 'nhưng', 'đến', 'từ', 'vào', 'ở', 'đây', 'này', 'đó', 'kia', 'các',
  'những', 'một', 'người', 'cái', 'lại', 'cũng', 'như', 'ra', 'về', 'nào',
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at'
]);

export function calculateRequiredExp(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function calculateLevel(totalExp: number): number {
  let level = 1;
  while (calculateRequiredExp(level) <= totalExp) {
    level++;
  }
  return level;
}
```

Create `packages/shared/src/index.ts`:
```typescript
export * from './types';
export * from './constants';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/shared test`
Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add pnpm-workspace.yaml package.json tsconfig.base.json .env.example packages/shared
git commit -m "feat(shared): setup monorepo workspace and shared contracts"
```

---

### Task 2: Database Layer & Mongoose Schemas (`apps/bot/src/models`)

**Files:**
- Create: `apps/bot/package.json`
- Create: `apps/bot/tsconfig.json`
- Create: `apps/bot/src/models/UserStat.ts`
- Create: `apps/bot/src/models/GuildConfig.ts`
- Create: `apps/bot/src/models/WordStat.ts`
- Create: `apps/bot/src/models/Reminder.ts`
- Create: `apps/bot/src/models/WheelSession.ts`
- Create: `apps/bot/src/models/database.ts`
- Test: `apps/bot/tests/models.test.ts`

**Interfaces:**
- Consumes: `@sentinel/shared` types
- Produces: `UserStatModel`, `GuildConfigModel`, `WordStatModel`, `ReminderModel`, `WheelSessionModel`, `connectDatabase(uri: string)`

- [ ] **Step 1: Write the failing test for MongoDB connection & schema validation**

Create `apps/bot/tests/models.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import mongoose from 'mongoose';
import { UserStatModel, GuildConfigModel } from '../src/models';

describe('MongoDB Mongoose Models Validation', () => {
  it('validates UserStat required fields and default values', () => {
    const user = new UserStatModel({
      guildId: '123456',
      userId: '78910',
      username: 'TestUser',
      avatar: 'https://example.com/avatar.png'
    });

    expect(user.totalVoiceSeconds).toBe(0);
    expect(user.totalMessages).toBe(0);
    expect(user.exp).toBe(0);
    expect(user.level).toBe(1);
    expect(user.dneCoins).toBe(0);
  });

  it('validates GuildConfig defaults', () => {
    const config = new GuildConfigModel({
      guildId: '123456',
      name: 'Sentinel Guild'
    });

    expect(config.welcomeVoiceTts).toBe(true);
    expect(config.welcomeMessage).toContain('Chào mừng');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/bot test`
Expected: FAIL with "Cannot find module '../src/models'"

- [ ] **Step 3: Implement Mongoose schemas and connection manager**

Create `apps/bot/package.json`:
```json
{
  "name": "@sentinel/bot",
  "version": "1.0.0",
  "main": "./dist/index.js",
  "scripts": {
    "build": "tsc -b",
    "start": "node --max-old-space-size=400 dist/index.js",
    "dev": "tsx watch src/index.ts",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@discordjs/voice": "^0.17.1",
    "@fastify/cors": "^9.0.1",
    "@fastify/jwt": "^8.0.1",
    "@fastify/websocket": "^10.0.1",
    "@sentinel/shared": "workspace:*",
    "discord.js": "^14.15.3",
    "dotenv": "^16.4.5",
    "fastify": "^4.28.1",
    "ffmpeg-static": "^5.2.0",
    "mongoose": "^8.5.1",
    "nanoid": "^5.0.7",
    "node-cron": "^3.0.3",
    "prism-media": "^1.3.5"
  },
  "devDependencies": {
    "@types/node": "^20.14.12",
    "@types/node-cron": "^3.0.11",
    "tsx": "^4.16.2",
    "typescript": "^5.5.4",
    "vitest": "^2.0.5"
  }
}
```

Create `apps/bot/tsconfig.json`:
```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

Create `apps/bot/src/models/UserStat.ts`:
```typescript
import { Schema, model, Document } from 'mongoose';
import { IUserStat } from '@sentinel/shared';

export interface UserStatDocument extends IUserStat, Document {}

const UserStatSchema = new Schema<UserStatDocument>({
  guildId: { type: String, required: true, index: true },
  userId: { type: String, required: true, index: true },
  username: { type: String, required: true },
  avatar: { type: String, default: '' },
  totalVoiceSeconds: { type: Number, default: 0 },
  totalMessages: { type: Number, default: 0 },
  totalImages: { type: Number, default: 0 },
  exp: { type: Number, default: 0 },
  level: { type: Number, default: 1 },
  dneCoins: { type: Number, default: 0 },
  dailyStreak: { type: Number, default: 0 },
  lastDailyAt: { type: Date },
  mentionedUsers: { type: Map, of: Number, default: {} },
  updatedAt: { type: Date, default: Date.now }
});

UserStatSchema.index({ guildId: 1, userId: 1 }, { unique: true });

export const UserStatModel = model<UserStatDocument>('UserStat', UserStatSchema);
```

Create `apps/bot/src/models/GuildConfig.ts`:
```typescript
import { Schema, model, Document } from 'mongoose';
import { IGuildConfig } from '@sentinel/shared';

export interface GuildConfigDocument extends IGuildConfig, Document {}

const GuildConfigSchema = new Schema<GuildConfigDocument>({
  guildId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  welcomeVoiceTts: { type: Boolean, default: true },
  welcomeMessage: { type: String, default: 'Chào mừng {user} đã tham gia phòng thoại!' },
  reportChannelId: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

export const GuildConfigModel = model<GuildConfigDocument>('GuildConfig', GuildConfigSchema);
```

Create `apps/bot/src/models/WordStat.ts`:
```typescript
import { Schema, model, Document } from 'mongoose';
import { IWordStat } from '@sentinel/shared';

export interface WordStatDocument extends IWordStat, Document {}

const WordStatSchema = new Schema<WordStatDocument>({
  guildId: { type: String, required: true, index: true },
  word: { type: String, required: true, index: true },
  count: { type: Number, default: 1 },
  lastSeenAt: { type: Date, default: Date.now, expires: '60d' }
});

WordStatSchema.index({ guildId: 1, word: 1 }, { unique: true });

export const WordStatModel = model<WordStatDocument>('WordStat', WordStatSchema);
```

Create `apps/bot/src/models/Reminder.ts`:
```typescript
import { Schema, model, Document } from 'mongoose';
import { IReminder } from '@sentinel/shared';

export interface ReminderDocument extends IReminder, Document {}

const ReminderSchema = new Schema<ReminderDocument>({
  userId: { type: String, required: true },
  guildId: { type: String, required: true },
  channelId: { type: String, required: true },
  message: { type: String, required: true },
  remindAt: { type: Date, required: true },
  status: { type: String, enum: ['pending', 'completed', 'cancelled'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

ReminderSchema.index({ remindAt: 1, status: 1 });

export const ReminderModel = model<ReminderDocument>('Reminder', ReminderSchema);
```

Create `apps/bot/src/models/WheelSession.ts`:
```typescript
import { Schema, model, Document } from 'mongoose';
import { IWheelSession } from '@sentinel/shared';

export interface WheelSessionDocument extends IWheelSession, Document {}

const WheelSessionSchema = new Schema<WheelSessionDocument>({
  sessionId: { type: String, required: true, unique: true },
  guildId: { type: String, required: true },
  createdBy: { type: String, required: true },
  title: { type: String, default: 'Vòng quay may mắn' },
  items: [{
    id: { type: String, required: true },
    label: { type: String, required: true },
    color: { type: String, required: true },
    weight: { type: Number, default: 1 }
  }],
  winner: { type: String },
  isCompleted: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now, expires: '24h' }
});

export const WheelSessionModel = model<WheelSessionDocument>('WheelSession', WheelSessionSchema);
```

Create `apps/bot/src/models/database.ts`:
```typescript
import mongoose from 'mongoose';

export async function connectDatabase(uri: string): Promise<typeof mongoose> {
  return mongoose.connect(uri, {
    dbName: 'DNE_BotDiscord',
    maxPoolSize: 10,
    minPoolSize: 2,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000
  });
}
```

Create `apps/bot/src/models/index.ts`:
```typescript
export * from './UserStat';
export * from './GuildConfig';
export * from './WordStat';
export * from './Reminder';
export * from './WheelSession';
export * from './database';
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/bot test`
Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/bot
git commit -m "feat(bot): add Mongoose schemas and database connection module"
```

---

### Task 3: Oracle VPS Anti-Idle Adaptive CPU Governor (`apps/bot/src/governor`)

**Files:**
- Create: `apps/bot/src/governor/cpuGovernor.worker.ts`
- Create: `apps/bot/src/governor/GovernorManager.ts`
- Create: `apps/bot/src/governor/metrics.ts`
- Test: `apps/bot/tests/governor.test.ts`

**Interfaces:**
- Consumes: None (Node.js `os` & `worker_threads`)
- Produces: `GovernorManager.start()`, `GovernorManager.stop()`, `GovernorManager.getMetrics()`, `calculateCpuUsage(sample1, sample2)`

- [ ] **Step 1: Write the failing test for CPU metric calculation and dynamic step regulation**

Create `apps/bot/tests/governor.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateCpuPercent, adjustDutyCycle } from '../src/governor/metrics';

describe('Adaptive CPU Governor Math & Metrics', () => {
  it('calculates CPU percentage from two tick snapshots accurately', () => {
    const prev = { idle: 1000, total: 2000 };
    const curr = { idle: 1600, total: 3000 };
    // totalDiff = 1000, idleDiff = 600, usedDiff = 400 => 40%
    const usage = calculateCpuPercent(prev, curr);
    expect(usage).toBeCloseTo(40, 1);
  });

  it('increases duty cycle when host CPU is below target 24%', () => {
    const currentBusyMs = 20;
    const adjusted = adjustDutyCycle(currentBusyMs, 18, 24);
    expect(adjusted).toBeGreaterThan(currentBusyMs);
  });

  it('decreases duty cycle when host CPU is above target 26%', () => {
    const currentBusyMs = 30;
    const adjusted = adjustDutyCycle(currentBusyMs, 32, 24);
    expect(adjusted).toBeLessThan(currentBusyMs);
  });

  it('drops duty cycle to 0 when host CPU exceeds safety threshold of 35%', () => {
    const currentBusyMs = 25;
    const adjusted = adjustDutyCycle(currentBusyMs, 38, 24);
    expect(adjusted).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/bot test`
Expected: FAIL with "Cannot find module '../src/governor/metrics'"

- [ ] **Step 3: Implement Governor metrics, worker thread, and manager**

Create `apps/bot/src/governor/metrics.ts`:
```typescript
import os from 'os';

export interface CpuTickSnapshot {
  idle: number;
  total: number;
}

export function sampleCpuTicks(): CpuTickSnapshot {
  const cpus = os.cpus();
  let idle = 0;
  let total = 0;

  for (const cpu of cpus) {
    for (const type in cpu.times) {
      total += cpu.times[type as keyof typeof cpu.times];
    }
    idle += cpu.times.idle;
  }

  return { idle, total };
}

export function calculateCpuPercent(prev: CpuTickSnapshot, curr: CpuTickSnapshot): number {
  const totalDiff = curr.total - prev.total;
  const idleDiff = curr.idle - prev.idle;
  if (totalDiff <= 0) return 0;
  const usedDiff = totalDiff - idleDiff;
  return (usedDiff / totalDiff) * 100;
}

export function adjustDutyCycle(currentBusyMs: number, currentCpuPercent: number, targetPercent = 24): number {
  if (currentCpuPercent > 35) {
    return 0; // Emergency cool-off: give full CPU to bot
  }
  if (currentCpuPercent < targetPercent - 2) {
    return Math.min(currentBusyMs + 2, 45); // Step up, cap at 45ms per 100ms
  }
  if (currentCpuPercent > targetPercent + 2) {
    return Math.max(currentBusyMs - 3, 0); // Step down
  }
  return currentBusyMs;
}
```

Create `apps/bot/src/governor/cpuGovernor.worker.ts`:
```typescript
import { parentPort } from 'worker_threads';
import crypto from 'crypto';
import { sampleCpuTicks, calculateCpuPercent, adjustDutyCycle } from './metrics';

let isRunning = true;
let busyMs = 24; // Initial 24ms per 100ms window
const WINDOW_MS = 100;

let lastSample = sampleCpuTicks();
let lastSampleTime = Date.now();

function burnCpu(durationMs: number) {
  const start = Date.now();
  while (Date.now() - start < durationMs) {
    crypto.createHash('sha256').update(crypto.randomBytes(32)).digest('hex');
  }
}

async function loop() {
  while (isRunning) {
    // 1. Feedback check every 5 seconds
    const now = Date.now();
    if (now - lastSampleTime >= 5000) {
      const currentSample = sampleCpuTicks();
      const currentCpu = calculateCpuPercent(lastSample, currentSample);
      busyMs = adjustDutyCycle(busyMs, currentCpu, 24);
      lastSample = currentSample;
      lastSampleTime = now;

      parentPort?.postMessage({
        type: 'TELEMETRY',
        cpuPercent: currentCpu,
        busyMs,
        memoryRssMb: Math.round(process.memoryUsage().rss / (1024 * 1024))
      });
    }

    // 2. Duty cycle execution
    if (busyMs > 0) {
      burnCpu(busyMs);
    }
    const sleepMs = Math.max(WINDOW_MS - busyMs, 5);
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }
}

parentPort?.on('message', (msg) => {
  if (msg.type === 'STOP') {
    isRunning = false;
  }
});

loop();
```

Create `apps/bot/src/governor/GovernorManager.ts`:
```typescript
import { Worker } from 'worker_threads';
import path from 'path';

export interface GovernorTelemetry {
  cpuPercent: number;
  busyMs: number;
  memoryRssMb: number;
  lastUpdated: Date;
}

export class GovernorManager {
  private worker: Worker | null = null;
  private latestTelemetry: GovernorTelemetry = {
    cpuPercent: 0,
    busyMs: 24,
    memoryRssMb: 0,
    lastUpdated: new Date()
  };

  public start() {
    if (this.worker) return;

    // Supports both tsx execution and compiled dist
    const workerPath = path.resolve(__dirname, 'cpuGovernor.worker.js');

    try {
      this.worker = new Worker(workerPath);
      this.worker.on('message', (msg) => {
        if (msg.type === 'TELEMETRY') {
          this.latestTelemetry = {
            cpuPercent: msg.cpuPercent,
            busyMs: msg.busyMs,
            memoryRssMb: msg.memoryRssMb,
            lastUpdated: new Date()
          };
        }
      });
      this.worker.on('error', (err) => console.error('Governor worker error:', err));
    } catch (e) {
      console.warn('Governor worker could not be started in current environment:', e);
    }
  }

  public stop() {
    if (this.worker) {
      this.worker.postMessage({ type: 'STOP' });
      this.worker.terminate();
      this.worker = null;
    }
  }

  public getTelemetry(): GovernorTelemetry {
    return this.latestTelemetry;
  }
}

export const governorManager = new GovernorManager();
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/bot test`
Expected: PASS with 6 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/bot/src/governor
git commit -m "feat(governor): implement adaptive duty-cycle CPU governor for Oracle anti-idle"
```

---

### Task 4: Fastify API Server & WebSocket Hub (`apps/bot/src/api`)

**Files:**
- Create: `apps/bot/src/api/server.ts`
- Create: `apps/bot/src/api/routes/health.ts`
- Create: `apps/bot/src/api/routes/leaderboard.ts`
- Create: `apps/bot/src/api/routes/wheel.ts`
- Create: `apps/bot/src/api/websocket/wheelSocket.ts`
- Test: `apps/bot/tests/api.test.ts`

**Interfaces:**
- Consumes: Mongoose Models, `governorManager`, `@sentinel/shared`
- Produces: `buildFastifyServer()`, WebSocket Room Manager

- [ ] **Step 1: Write failing test for Fastify health route & wheel session REST API**

Create `apps/bot/tests/api.test.ts`:
```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { buildFastifyServer } from '../src/api/server';

describe('Fastify REST API & Health Check', () => {
  let app: ReturnType<typeof buildFastifyServer>;

  beforeAll(async () => {
    app = buildFastifyServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns status ok with telemetry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('telemetry');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/bot test`
Expected: FAIL with "Cannot find module '../src/api/server'"

- [ ] **Step 3: Implement Fastify server, routes, and WebSocket hub**

Create `apps/bot/src/api/routes/health.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { governorManager } from '../../governor/GovernorManager';

export async function healthRoutes(app: FastifyInstance) {
  app.get('/api/health', async () => {
    return {
      status: 'ok',
      uptime: process.uptime(),
      memory: {
        rssMb: Math.round(process.memoryUsage().rss / (1024 * 1024)),
        heapUsedMb: Math.round(process.memoryUsage().heapUsed / (1024 * 1024))
      },
      telemetry: governorManager.getTelemetry()
    };
  });
}
```

Create `apps/bot/src/api/routes/leaderboard.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { UserStatModel } from '../../models/UserStat';
import { WordStatModel } from '../../models/WordStat';

export async function leaderboardRoutes(app: FastifyInstance) {
  app.get('/api/guilds/:guildId/leaderboard', async (req) => {
    const { guildId } = req.params as { guildId: string };

    const [topVoice, topChat, topLevel] = await Promise.all([
      UserStatModel.find({ guildId }).sort({ totalVoiceSeconds: -1 }).limit(10).lean(),
      UserStatModel.find({ guildId }).sort({ totalMessages: -1 }).limit(10).lean(),
      UserStatModel.find({ guildId }).sort({ level: -1, exp: -1 }).limit(10).lean()
    ]);

    return { topVoice, topChat, topLevel };
  });

  app.get('/api/guilds/:guildId/wordcloud', async (req) => {
    const { guildId } = req.params as { guildId: string };
    const words = await WordStatModel.find({ guildId }).sort({ count: -1 }).limit(50).lean();
    return { words };
  });
}
```

Create `apps/bot/src/api/websocket/wheelSocket.ts`:
```typescript
import { WebSocket } from 'ws';
import { WheelSessionModel } from '../../models/WheelSession';

interface ClientEntry {
  ws: WebSocket;
  sessionId: string;
}

const rooms = new Map<string, Set<WebSocket>>();

export function registerWheelClient(sessionId: string, ws: WebSocket) {
  if (!rooms.has(sessionId)) {
    rooms.set(sessionId, new Set());
  }
  rooms.get(sessionId)!.add(ws);

  ws.on('close', () => {
    const room = rooms.get(sessionId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) rooms.delete(sessionId);
    }
  });
}

export function broadcastWheelEvent(sessionId: string, payload: object) {
  const room = rooms.get(sessionId);
  if (!room) return;
  const msg = JSON.stringify(payload);
  for (const client of room) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(msg);
    }
  }
}
```

Create `apps/bot/src/api/routes/wheel.ts`:
```typescript
import { FastifyInstance } from 'fastify';
import { nanoid } from 'nanoid';
import { WheelSessionModel } from '../../models/WheelSession';
import { broadcastWheelEvent } from '../websocket/wheelSocket';

export async function wheelRoutes(app: FastifyInstance) {
  app.get('/api/wheel/:sessionId', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const session = await WheelSessionModel.findOne({ sessionId }).lean();
    if (!session) return reply.status(404).send({ error: 'Session not found' });
    return session;
  });

  app.post('/api/wheel/:sessionId/spin', async (req, reply) => {
    const { sessionId } = req.params as { sessionId: string };
    const session = await WheelSessionModel.findOne({ sessionId });
    if (!session || session.items.length === 0) {
      return reply.status(400).send({ error: 'Invalid session or empty items' });
    }

    const targetIndex = Math.floor(Math.random() * session.items.length);
    const winner = session.items[targetIndex].label;
    const durationMs = 6000;
    const targetAngle = 360 * 5 + (360 / session.items.length) * targetIndex;

    session.winner = winner;
    session.isCompleted = true;
    await session.save();

    broadcastWheelEvent(sessionId, {
      event: 'SPIN_START',
      targetIndex,
      targetAngle,
      durationMs,
      startedAt: Date.now()
    });

    setTimeout(() => {
      broadcastWheelEvent(sessionId, {
        event: 'SPIN_END',
        winner,
        targetIndex
      });
    }, durationMs);

    return { targetIndex, winner, durationMs };
  });
}
```

Create `apps/bot/src/api/server.ts`:
```typescript
import fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import { healthRoutes } from './routes/health';
import { leaderboardRoutes } from './routes/leaderboard';
import { wheelRoutes } from './routes/wheel';
import { registerWheelClient } from './websocket/wheelSocket';

export function buildFastifyServer() {
  const app = fastify({ logger: false });

  app.register(cors, {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'DELETE']
  });

  app.register(websocket);

  app.register(healthRoutes);
  app.register(leaderboardRoutes);
  app.register(wheelRoutes);

  app.register(async function (fastifyInstance) {
    fastifyInstance.get('/ws/wheel/:sessionId', { websocket: true }, (connection, req) => {
      const { sessionId } = req.params as { sessionId: string };
      registerWheelClient(sessionId, connection.socket);
    });
  });

  return app;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/bot test`
Expected: PASS with 7 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/bot/src/api
git commit -m "feat(api): implement Fastify REST routes and synchronized WebSocket hub"
```

---

### Task 5: Voice Tracking & TTS Welcome Service (`apps/bot/src/services/voice`)

**Files:**
- Create: `apps/bot/src/services/voice/VoiceService.ts`
- Create: `apps/bot/src/services/voice/ttsStream.ts`
- Test: `apps/bot/tests/voice.test.ts`

**Interfaces:**
- Consumes: `UserStatModel`, `GuildConfigModel`, `@discordjs/voice`
- Produces: `VoiceService.handleVoiceStateUpdate()`, `VoiceService.playGreeting()`

- [ ] **Step 1: Write failing test for Voice tracking calculation & rewards**

Create `apps/bot/tests/voice.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateVoiceRewards } from '../src/services/voice/VoiceService';

describe('Voice Rewards Math', () => {
  it('awards 10 EXP and 5 Coins per 300 seconds (5 mins)', () => {
    const rewards = calculateVoiceRewards(600); // 10 minutes
    expect(rewards.exp).toBe(20);
    expect(rewards.coins).toBe(10);
  });

  it('awards 0 if duration is under 5 minutes', () => {
    const rewards = calculateVoiceRewards(150);
    expect(rewards.exp).toBe(0);
    expect(rewards.coins).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/bot test`
Expected: FAIL with "Cannot find module '../src/services/voice/VoiceService'"

- [ ] **Step 3: Implement Voice service and TTS streaming**

Create `apps/bot/src/services/voice/ttsStream.ts`:
```typescript
import https from 'https';
import { Readable } from 'stream';

export function getVietnameseTtsStream(text: string): Readable {
  const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=vi&client=tw-ob`;
  const readable = new Readable({ read() {} });

  https.get(url, (res) => {
    res.on('data', (chunk) => readable.push(chunk));
    res.on('end', () => readable.push(null));
  }).on('error', (err) => {
    readable.destroy(err);
  });

  return readable;
}
```

Create `apps/bot/src/services/voice/VoiceService.ts`:
```typescript
import { VoiceState } from 'discord.js';
import {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus
} from '@discordjs/voice';
import { UserStatModel } from '../../models/UserStat';
import { GuildConfigModel } from '../../models/GuildConfig';
import { getVietnameseTtsStream } from './ttsStream';

const activeVoiceSessions = new Map<string, number>(); // `${guildId}:${userId}` -> timestamp

export function calculateVoiceRewards(durationSeconds: number) {
  const intervals = Math.floor(durationSeconds / 300); // every 5 mins
  return {
    exp: intervals * 10,
    coins: intervals * 5
  };
}

export class VoiceService {
  public static async handleVoiceStateUpdate(oldState: VoiceState, newState: VoiceState) {
    const userId = newState.id || oldState.id;
    const guildId = newState.guild.id || oldState.guild.id;
    if (newState.member?.user.bot) return;

    const sessionKey = `${guildId}:${userId}`;

    // 1. User Joined Voice Channel
    if (!oldState.channelId && newState.channelId) {
      activeVoiceSessions.set(sessionKey, Date.now());

      // Trigger TTS Greeting
      const config = await GuildConfigModel.findOne({ guildId });
      if (config?.welcomeVoiceTts) {
        const welcomeText = (config.welcomeMessage || 'Chào mừng {user}').replace(
          '{user}',
          newState.member?.displayName || 'thành viên'
        );
        VoiceService.playGreeting(newState, welcomeText);
      }
    }

    // 2. User Left Voice Channel
    if (oldState.channelId && !newState.channelId) {
      const joinTime = activeVoiceSessions.get(sessionKey);
      if (joinTime) {
        const durationSeconds = Math.floor((Date.now() - joinTime) / 1000);
        activeVoiceSessions.delete(sessionKey);

        const rewards = calculateVoiceRewards(durationSeconds);

        await UserStatModel.findOneAndUpdate(
          { guildId, userId },
          {
            $inc: {
              totalVoiceSeconds: durationSeconds,
              exp: rewards.exp,
              dneCoins: rewards.coins
            },
            $set: {
              username: oldState.member?.user.username || 'User',
              avatar: oldState.member?.user.displayAvatarURL() || '',
              updatedAt: new Date()
            }
          },
          { upsert: true }
        );
      }
    }
  }

  public static async playGreeting(state: VoiceState, message: string) {
    if (!state.channel) return;

    const connection = joinVoiceChannel({
      channelId: state.channel.id,
      guildId: state.guild.id,
      adapterCreator: state.guild.voiceAdapterCreator
    });

    const player = createAudioPlayer();
    const stream = getVietnameseTtsStream(message);
    const resource = createAudioResource(stream);

    player.play(resource);
    connection.subscribe(player);

    player.on(AudioPlayerStatus.Idle, () => {
      player.stop();
      connection.destroy();
    });

    player.on('error', () => {
      connection.destroy();
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/bot test`
Expected: PASS with 9 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/bot/src/services/voice
git commit -m "feat(bot): implement voice duration tracking and TTS greeting stream"
```

---

### Task 6: Message, Image & Word Analytics Engine (`apps/bot/src/services/analytics`)

**Files:**
- Create: `apps/bot/src/services/analytics/textParser.ts`
- Create: `apps/bot/src/services/analytics/AnalyticsService.ts`
- Create: `apps/bot/src/services/analytics/WeeklyReportCron.ts`
- Test: `apps/bot/tests/analytics.test.ts`

**Interfaces:**
- Consumes: `STOP_WORDS`, `UserStatModel`, `WordStatModel`
- Produces: `tokenizeMessage(text: string)`, `AnalyticsService.handleMessage()`, `generateWeeklySummary()`

- [ ] **Step 1: Write failing test for message tokenization & mention parser**

Create `apps/bot/tests/analytics.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { tokenizeMessage, extractMentions } from '../src/services/analytics/textParser';

describe('Text Parser & Stop-words Stripping', () => {
  it('tokenizes text, strips punctuation, and removes stop-words', () => {
    const text = 'Hôm nay trời rất đẹp và tôi là người chiến thắng!';
    const tokens = tokenizeMessage(text);
    expect(tokens).toContain('hôm');
    expect(tokens).toContain('đẹp');
    expect(tokens).toContain('thắng');
    expect(tokens).not.toContain('và');
    expect(tokens).not.toContain('là');
  });

  it('extracts Discord user mention IDs accurately', () => {
    const text = 'Chào bạn <@123456789> và <@!987654321> nhé!';
    const mentions = extractMentions(text);
    expect(mentions).toEqual(['123456789', '987654321']);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/bot test`
Expected: FAIL with "Cannot find module '../src/services/analytics/textParser'"

- [ ] **Step 3: Implement tokenizer, message handler, and cron reporter**

Create `apps/bot/src/services/analytics/textParser.ts`:
```typescript
import { STOP_WORDS } from '@sentinel/shared';

export function tokenizeMessage(content: string): string[] {
  return content
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, '') // remove links
    .replace(/<[@#&]!?\d+>/g, '') // remove Discord mentions/channels
    .replace(/[^\p{L}\p{N}\s]/gu, '') // strip special chars keeping unicode letters
    .split(/\s+/)
    .filter((word) => word.length >= 2 && !STOP_WORDS.has(word));
}

export function extractMentions(content: string): string[] {
  const matches = content.match(/<@!?(\d+)>/g);
  if (!matches) return [];
  return matches.map((m) => m.replace(/<@!?/, '').replace('>', ''));
}
```

Create `apps/bot/src/services/analytics/AnalyticsService.ts`:
```typescript
import { Message } from 'discord.js';
import { UserStatModel } from '../../models/UserStat';
import { WordStatModel } from '../../models/WordStat';
import { tokenizeMessage, extractMentions } from './textParser';

const chatCooldowns = new Map<string, number>();

export class AnalyticsService {
  public static async handleMessage(message: Message) {
    if (message.author.bot || !message.guild) return;

    const guildId = message.guild.id;
    const userId = message.author.id;
    const imageCount = message.attachments.filter((att) =>
      att.contentType?.startsWith('image/')
    ).size;

    // EXP Cooldown check (60s)
    const cooldownKey = `${guildId}:${userId}`;
    const now = Date.now();
    const lastAwarded = chatCooldowns.get(cooldownKey) || 0;
    const awardExp = now - lastAwarded >= 60000 ? Math.floor(Math.random() * 10) + 15 : 0;
    if (awardExp > 0) chatCooldowns.set(cooldownKey, now);

    // Extract mentions
    const mentions = extractMentions(message.content);
    const mentionIncObj: Record<string, number> = {};
    for (const mId of mentions) {
      mentionIncObj[`mentionedUsers.${mId}`] = 1;
    }

    // Upsert User Stat
    await UserStatModel.findOneAndUpdate(
      { guildId, userId },
      {
        $inc: {
          totalMessages: 1,
          totalImages: imageCount,
          exp: awardExp,
          ...mentionIncObj
        },
        $set: {
          username: message.author.username,
          avatar: message.author.displayAvatarURL(),
          updatedAt: new Date()
        }
      },
      { upsert: true }
    );

    // Tokenize and batch update words
    const tokens = tokenizeMessage(message.content);
    if (tokens.length > 0) {
      const bulkOps = tokens.map((word) => ({
        updateOne: {
          filter: { guildId, word },
          update: { $inc: { count: 1 }, $set: { lastSeenAt: new Date() } },
          upsert: true
        }
      }));
      await WordStatModel.bulkWrite(bulkOps);
    }
  }
}
```

Create `apps/bot/src/services/analytics/WeeklyReportCron.ts`:
```typescript
import cron from 'node-cron';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { UserStatModel } from '../../models/UserStat';
import { WordStatModel } from '../../models/WordStat';
import { GuildConfigModel } from '../../models/GuildConfig';

export function scheduleWeeklyReports(client: Client) {
  // Every Monday at 00:00:00
  cron.schedule('0 0 * * 1', async () => {
    const guilds = await GuildConfigModel.find({ reportChannelId: { $exists: true } });

    for (const g of guilds) {
      if (!g.reportChannelId) continue;
      const channel = (await client.channels.fetch(g.reportChannelId).catch(() => null)) as TextChannel | null;
      if (!channel) continue;

      const [topVoice, topChat, topWords] = await Promise.all([
        UserStatModel.find({ guildId: g.guildId }).sort({ totalVoiceSeconds: -1 }).limit(3),
        UserStatModel.find({ guildId: g.guildId }).sort({ totalMessages: -1 }).limit(3),
        WordStatModel.find({ guildId: g.guildId }).sort({ count: -1 }).limit(5)
      ]);

      const embed = new EmbedBuilder()
        .setTitle('📊 BÁO CÁO HOẠT ĐỘNG TUẦN - SENTINEL BOT')
        .setColor(0x00f2fe)
        .addFields(
          {
            name: '🏆 Top Voice Champions',
            value: topVoice.map((u, i) => `${i + 1}. **${u.username}** - ${Math.round(u.totalVoiceSeconds / 3600)}h`).join('\n') || 'Chưa có dữ liệu'
          },
          {
            name: '💬 Top Chiến Thần Chat',
            value: topChat.map((u, i) => `${i + 1}. **${u.username}** - ${u.totalMessages} tin nhắn`).join('\n') || 'Chưa có dữ liệu'
          },
          {
            name: '🔥 Từ Khóa Hot Nhất Tuần',
            value: topWords.map((w) => `\`${w.word}\` (${w.count})`).join(', ') || 'Chưa có dữ liệu'
          }
        )
        .setTimestamp();

      await channel.send({ embeds: [embed] });
    }
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/bot test`
Expected: PASS with 11 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/bot/src/services/analytics
git commit -m "feat(bot): implement message, image, word frequency NLP analytics and weekly report cron"
```

---

### Task 7: Leveling (XP), Economy & Reminders Subsystems (`apps/bot/src/services`)

**Files:**
- Create: `apps/bot/src/services/economy/EconomyService.ts`
- Create: `apps/bot/src/services/reminder/ReminderService.ts`
- Test: `apps/bot/tests/economy.test.ts`

**Interfaces:**
- Consumes: `UserStatModel`, `ReminderModel`
- Produces: `EconomyService.claimDaily()`, `EconomyService.transfer()`, `ReminderService.createReminder()`, `ReminderService.pollReminders()`

- [ ] **Step 1: Write failing test for daily claim and streak calculations**

Create `apps/bot/tests/economy.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { calculateDailyStreak } from '../src/services/economy/EconomyService';

describe('Daily Claim Streak Calculation', () => {
  it('increments streak if claimed within 24-48 hours', () => {
    const yesterday = new Date(Date.now() - 26 * 3600 * 1000);
    const result = calculateDailyStreak(3, yesterday);
    expect(result.newStreak).toBe(4);
    expect(result.rewardCoins).toBe(130); // 100 + 10% * 3
  });

  it('resets streak to 1 if more than 48 hours have passed', () => {
    const threeDaysAgo = new Date(Date.now() - 72 * 3600 * 1000);
    const result = calculateDailyStreak(5, threeDaysAgo);
    expect(result.newStreak).toBe(1);
    expect(result.rewardCoins).toBe(100);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/bot test`
Expected: FAIL with "Cannot find module '../src/services/economy/EconomyService'"

- [ ] **Step 3: Implement Economy and Reminder services**

Create `apps/bot/src/services/economy/EconomyService.ts`:
```typescript
import { UserStatModel } from '../../models/UserStat';

export function calculateDailyStreak(currentStreak: number, lastDailyAt?: Date) {
  if (!lastDailyAt) {
    return { newStreak: 1, rewardCoins: 100 };
  }

  const hoursDiff = (Date.now() - lastDailyAt.getTime()) / (1000 * 3600);
  if (hoursDiff < 20) {
    throw new Error('Bạn đã nhận điểm danh hôm nay rồi! Hãy quay lại sau.');
  }

  if (hoursDiff <= 48) {
    const newStreak = Math.min(currentStreak + 1, 7);
    const bonus = (newStreak - 1) * 10;
    return { newStreak, rewardCoins: 100 + bonus };
  }

  // Broken streak
  return { newStreak: 1, rewardCoins: 100 };
}

export class EconomyService {
  public static async claimDaily(guildId: string, userId: string) {
    const stat = await UserStatModel.findOne({ guildId, userId });
    const { newStreak, rewardCoins } = calculateDailyStreak(stat?.dailyStreak || 0, stat?.lastDailyAt);

    await UserStatModel.findOneAndUpdate(
      { guildId, userId },
      {
        $inc: { dneCoins: rewardCoins },
        $set: { dailyStreak: newStreak, lastDailyAt: new Date() }
      },
      { upsert: true }
    );

    return { streak: newStreak, reward: rewardCoins };
  }

  public static async transferCoins(guildId: string, fromId: string, toId: string, amount: number) {
    if (amount <= 0) throw new Error('Số xu chuyển phải lớn hơn 0');

    const sender = await UserStatModel.findOne({ guildId, userId: fromId });
    if (!sender || sender.dneCoins < amount) {
      throw new Error('Số dư của bạn không đủ để thực hiện giao dịch!');
    }

    await UserStatModel.findOneAndUpdate({ guildId, userId: fromId }, { $inc: { dneCoins: -amount } });
    await UserStatModel.findOneAndUpdate({ guildId, userId: toId }, { $inc: { dneCoins: amount } }, { upsert: true });

    return true;
  }
}
```

Create `apps/bot/src/services/reminder/ReminderService.ts`:
```typescript
import { Client, TextChannel } from 'discord.js';
import { ReminderModel } from '../../models/Reminder';

export class ReminderService {
  public static startPolling(client: Client) {
    setInterval(async () => {
      const now = new Date();
      const dueReminders = await ReminderModel.find({
        remindAt: { $lte: now },
        status: 'pending'
      }).limit(20);

      for (const rem of dueReminders) {
        rem.status = 'completed';
        await rem.save();

        try {
          const channel = (await client.channels.fetch(rem.channelId)) as TextChannel;
          if (channel) {
            await channel.send(`⏰ <@${rem.userId}> **NHẮC NHỞ:** ${rem.message}`);
          }
        } catch (e) {
          console.warn('Failed to send reminder to channel:', rem.channelId, e);
        }
      }
    }, 30000);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/bot test`
Expected: PASS with 13 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/bot/src/services/economy apps/bot/src/services/reminder
git commit -m "feat(bot): implement economy streak engine and reminder scheduler"
```

---

### Task 8: Multiplayer Mini-Games & Discord Wheel Command (`apps/bot/src/services/game`)

**Files:**
- Create: `apps/bot/src/services/game/WordChainGame.ts`
- Create: `apps/bot/src/services/game/BauCuaGame.ts`
- Create: `apps/bot/src/commands/random.ts`
- Create: `apps/bot/src/commands/game.ts`
- Test: `apps/bot/tests/games.test.ts`

**Interfaces:**
- Consumes: `WheelSessionModel`, `UserStatModel`
- Produces: `WordChainGame.submitWord()`, `BauCuaGame.roll()`, `/random wheel` slash command

- [ ] **Step 1: Write failing test for Word Chain validation and Bầu Cua payout calculation**

Create `apps/bot/tests/games.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { validateWordChain } from '../src/services/game/WordChainGame';
import { calculateBauCuaPayout } from '../src/services/game/BauCuaGame';

describe('Mini-Games Logic', () => {
  it('validates word chain: word must start with previous word ending', () => {
    expect(validateWordChain('hoa hồng', 'hồng hào')).toBe(true);
    expect(validateWordChain('hoa hồng', 'bông hoa')).toBe(false);
  });

  it('calculates Bầu Cua payout based on matched dice', () => {
    const rolled = ['BẦU', 'CUA', 'BẦU'];
    // Bet 100 on BẦU => 2 matches => returns 100 (original) + 200 (profit) = 300
    const payoutBau = calculateBauCuaPayout('BẦU', 100, rolled);
    expect(payoutBau).toBe(300);

    // Bet 100 on GÀ => 0 matches => 0
    const payoutGa = calculateBauCuaPayout('GÀ', 100, rolled);
    expect(payoutGa).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/bot test`
Expected: FAIL with "Cannot find module '../src/services/game/WordChainGame'"

- [ ] **Step 3: Implement games engine and slash commands**

Create `apps/bot/src/services/game/WordChainGame.ts`:
```typescript
const channelChainState = new Map<string, string>(); // channelId -> lastWord

export function validateWordChain(prevWord: string, nextWord: string): boolean {
  const prevTokens = prevWord.trim().toLowerCase().split(/\s+/);
  const nextTokens = nextWord.trim().toLowerCase().split(/\s+/);
  if (prevTokens.length < 2 || nextTokens.length < 2) return false;
  return prevTokens[prevTokens.length - 1] === nextTokens[0];
}

export class WordChainGame {
  public static processWord(channelId: string, word: string) {
    const lastWord = channelChainState.get(channelId);
    if (!lastWord) {
      channelChainState.set(channelId, word);
      return { success: true, message: `Bắt đầu chuỗi với: **${word}**` };
    }

    if (!validateWordChain(lastWord, word)) {
      return {
        success: false,
        message: `Sai rồi! Từ tiếp theo phải bắt đầu bằng **${lastWord.split(' ').pop()}**.`
      };
    }

    channelChainState.set(channelId, word);
    return { success: true, message: `Hợp lệ! Từ tiếp theo phải bắt đầu bằng **${word.split(' ').pop()}**.` };
  }
}
```

Create `apps/bot/src/services/game/BauCuaGame.ts`:
```typescript
export const BAU_CUA_ITEMS = ['BẦU', 'CUA', 'TÔM', 'CÁ', 'GÀ', 'NAI'] as const;
export type BauCuaItem = (typeof BAU_CUA_ITEMS)[number];

export function calculateBauCuaPayout(betItem: BauCuaItem, betAmount: number, rolled: string[]): number {
  const matches = rolled.filter((item) => item === betItem).length;
  if (matches === 0) return 0;
  return betAmount + betAmount * matches;
}

export class BauCuaGame {
  public static rollDice(): BauCuaItem[] {
    return [
      BAU_CUA_ITEMS[Math.floor(Math.random() * 6)],
      BAU_CUA_ITEMS[Math.floor(Math.random() * 6)],
      BAU_CUA_ITEMS[Math.floor(Math.random() * 6)]
    ];
  }
}
```

Create `apps/bot/src/commands/random.ts`:
```typescript
import {
  ChatInputCommandInteraction,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder
} from 'discord.js';
import { nanoid } from 'nanoid';
import { WheelSessionModel } from '../models/WheelSession';

export async function handleRandomWheelCommand(interaction: ChatInputCommandInteraction) {
  const itemsRaw = interaction.options.getString('items', true);
  const items = itemsRaw.split(',').map((label, idx) => ({
    id: `item-${idx}`,
    label: label.trim(),
    color: ['#00F2FE', '#7F00FF', '#FF007F', '#FFB300', '#00E676'][idx % 5]
  }));

  if (items.length < 2) {
    return interaction.reply({ content: 'Vui lòng nhập ít nhất 2 mục, cách nhau bởi dấu phẩy!', ephemeral: true });
  }

  const sessionId = nanoid(8);
  await WheelSessionModel.create({
    sessionId,
    guildId: interaction.guildId || 'dm',
    createdBy: interaction.user.username,
    items
  });

  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const webLink = `${frontendUrl}/wheel?session=${sessionId}`;

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setLabel('🎡 Mở Vòng Quay 3D trên Web')
      .setStyle(ButtonStyle.Link)
      .setURL(webLink),
    new ButtonBuilder()
      .setCustomId(`spin_quick_${sessionId}`)
      .setLabel('⚡ Quay Nhanh tại Discord')
      .setStyle(ButtonStyle.Primary)
  );

  const embed = new EmbedBuilder()
    .setTitle('🎡 VÒNG QUAY MAY MẮN - DNE BOT')
    .setDescription(`Đã tạo phiên quay với **${items.length}** mục!\nBấm nút bên dưới để mở giao diện Web 3D hoặc quay nhanh.`)
    .setColor(0x7f00ff);

  await interaction.reply({ embeds: [embed], components: [row] });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/bot test`
Expected: PASS with 15 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/bot/src/services/game apps/bot/src/commands
git commit -m "feat(bot): implement multiplayer mini-games and /random wheel command"
```

---

### Task 9: Vue 3 Cyber Web Dashboard Setup & Layout (`apps/web`)

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/index.html`
- Create: `apps/web/src/assets/main.css`
- Create: `apps/web/src/stores/auth.ts`
- Create: `apps/web/src/components/DensityToggle.vue`
- Create: `apps/web/src/App.vue`
- Test: `apps/web/tests/density.test.ts`

**Interfaces:**
- Consumes: `@sentinel/shared`
- Produces: Vue 3 Application Scaffold, Glassmorphism theme, Density store

- [ ] **Step 1: Write failing test for Density Store state management**

Create `apps/web/tests/density.test.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDensityStore } from '../src/stores/density';

describe('Dashboard Density Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('toggles between immersive and compact modes', () => {
    const store = useDensityStore();
    expect(store.mode).toBe('immersive');
    store.toggleMode();
    expect(store.mode).toBe('compact');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/web test`
Expected: FAIL with "Cannot find module '../src/stores/density'"

- [ ] **Step 3: Implement Vue 3 scaffold, density store, and cyberpunk glassmorphism CSS**

Create `apps/web/package.json`:
```json
{
  "name": "@sentinel/web",
  "version": "1.0.0",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run"
  },
  "dependencies": {
    "@sentinel/shared": "workspace:*",
    "canvas-confetti": "^1.9.3",
    "gsap": "^3.12.5",
    "lucide-vue-next": "^0.414.0",
    "pinia": "^2.2.0",
    "vue": "^3.4.34",
    "vue-router": "^4.4.0"
  },
  "devDependencies": {
    "@types/canvas-confetti": "^1.9.0",
    "@vitejs/plugin-vue": "^5.1.1",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.40",
    "tailwindcss": "^3.4.7",
    "typescript": "^5.5.4",
    "vite": "^5.3.5",
    "vitest": "^2.0.5",
    "vue-tsc": "^2.0.29"
  }
}
```

Create `apps/web/src/stores/density.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useDensityStore = defineStore('density', () => {
  const mode = ref<'immersive' | 'compact'>('immersive');

  function toggleMode() {
    mode.value = mode.value === 'immersive' ? 'compact' : 'immersive';
  }

  return { mode, toggleMode };
});
```

Create `apps/web/src/assets/main.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --bg-space: #0a0b10;
  --glass-surface: rgba(18, 22, 36, 0.7);
  --glass-border: rgba(255, 255, 255, 0.08);
  --neon-cyan: #00f2fe;
  --neon-violet: #7f00ff;
}

body {
  margin: 0;
  background-color: var(--bg-space);
  color: #f3f4f6;
  font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
  overflow-x: hidden;
}

.glass-panel {
  background: var(--glass-surface);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--glass-border);
  box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
}

.shimmer-sweep {
  background: linear-gradient(
    90deg,
    rgba(255, 255, 255, 0) 0%,
    rgba(255, 255, 255, 0.2) 50%,
    rgba(255, 255, 255, 0) 100%
  );
  background-size: 200% 100%;
  animation: sweep 2.5s infinite;
}

@keyframes sweep {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
```

Create `apps/web/src/components/DensityToggle.vue`:
```vue
<script setup lang="ts">
import { useDensityStore } from '../stores/density';
import { LayoutGrid, Minimize2 } from 'lucide-vue-next';

const density = useDensityStore();
</script>

<template>
  <button
    @click="density.toggleMode"
    class="flex items-center gap-2 px-3 py-1.5 rounded-full glass-panel hover:border-cyan-400/50 transition-all text-sm font-medium"
  >
    <component :is="density.mode === 'immersive' ? LayoutGrid : Minimize2" class="w-4 h-4 text-cyan-400" />
    <span>{{ density.mode === 'immersive' ? 'Chế độ Trực quan' : 'Chế độ Thu gọn' }}</span>
  </button>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/web test`
Expected: PASS with 1 test passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web
git commit -m "feat(web): setup Vue 3 cyberpunk glassmorphism layout and density store"
```

---

### Task 10: Vue 3 Retina Canvas 3D Physics Wheel (`apps/web/src/components/Wheel3D.vue`)

**Files:**
- Create: `apps/web/src/composables/useWheelSocket.ts`
- Create: `apps/web/src/composables/useSoundEffect.ts`
- Create: `apps/web/src/components/Wheel3D.vue`
- Test: `apps/web/tests/wheel.test.ts`

**Interfaces:**
- Consumes: `@sentinel/shared`, Web Audio API, Canvas Confetti
- Produces: `Wheel3D.vue` interactive physics wheel, `useWheelSocket` sync composable

- [ ] **Step 1: Write failing test for slice angle calculations**

Create `apps/web/tests/wheel.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

export function calculateSliceAngle(totalSlices: number): number {
  if (totalSlices <= 0) return 0;
  return (2 * Math.PI) / totalSlices;
}

describe('Wheel Angle Math', () => {
  it('divides circle evenly into radian slices', () => {
    const angle4 = calculateSliceAngle(4);
    expect(angle4).toBeCloseTo(Math.PI / 2);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/web test`
Expected: FAIL if test file has syntax or assertions

- [ ] **Step 3: Implement Web Audio sound synthesizer, WebSocket hook, and Canvas wheel**

Create `apps/web/src/composables/useSoundEffect.ts`:
```typescript
export function useSoundEffect() {
  let ctx: AudioContext | null = null;

  function initCtx() {
    if (!ctx) ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  }

  function playTick() {
    try {
      initCtx();
      if (!ctx) return;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(600, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.05);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.05);
    } catch {}
  }

  return { playTick };
}
```

Create `apps/web/src/composables/useWheelSocket.ts`:
```typescript
import { ref, onMounted, onUnmounted } from 'vue';
import { WheelSocketEvent } from '@sentinel/shared';

export function useWheelSocket(sessionId: string, onSpinStart: (data: any) => void, onSpinEnd: (data: any) => void) {
  const ws = ref<WebSocket | null>(null);

  onMounted(() => {
    const wsUrl = `${import.meta.env.VITE_WS_URL || 'ws://localhost:3000'}/ws/wheel/${sessionId}`;
    ws.value = new WebSocket(wsUrl);

    ws.value.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data) as WheelSocketEvent;
        if (payload.event === 'SPIN_START') onSpinStart(payload);
        if (payload.event === 'SPIN_END') onSpinEnd(payload);
      } catch {}
    };
  });

  onUnmounted(() => {
    ws.value?.close();
  });
}
```

Create `apps/web/src/components/Wheel3D.vue`:
```vue
<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import confetti from 'canvas-confetti';
import { useSoundEffect } from '../composables/useSoundEffect';

const props = defineProps<{
  items: Array<{ id: string; label: string; color: string }>;
  isSpinning?: boolean;
}>();

const emit = defineEmits(['spin-end']);

const canvasRef = ref<HTMLCanvasElement | null>(null);
const currentAngle = ref(0);
const { playTick } = useSoundEffect();

function drawWheel() {
  const canvas = canvasRef.value;
  if (!canvas || props.items.length === 0) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const size = 440;
  canvas.width = size * dpr;
  canvas.height = size * dpr;
  ctx.scale(dpr, dpr);

  const center = size / 2;
  const radius = center - 20;
  const sliceAngle = (2 * Math.PI) / props.items.length;

  ctx.clearRect(0, 0, size, size);

  // Slices
  props.items.forEach((item, i) => {
    const start = currentAngle.value + i * sliceAngle;
    const end = start + sliceAngle;

    ctx.beginPath();
    ctx.moveTo(center, center);
    ctx.arc(center, center, radius, start, end);
    ctx.closePath();
    ctx.fillStyle = item.color;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.stroke();

    // Labels
    ctx.save();
    ctx.translate(center, center);
    ctx.rotate(start + sliceAngle / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px "Plus Jakarta Sans", sans-serif';
    ctx.fillText(item.label, radius - 20, 5);
    ctx.restore();
  });

  // Metallic Center Hub
  ctx.beginPath();
  ctx.arc(center, center, 35, 0, 2 * Math.PI);
  ctx.fillStyle = '#0a0b10';
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#00F2FE';
  ctx.stroke();
}

onMounted(() => drawWheel());
watch(() => props.items, drawWheel, { deep: true });
</script>

<template>
  <div class="relative flex flex-col items-center justify-center p-6 glass-panel rounded-3xl">
    <!-- Flapper Pointer -->
    <div class="absolute top-2 z-20 w-0 h-0 border-l-[14px] border-l-transparent border-r-[14px] border-r-transparent border-t-[28px] border-t-cyan-400 drop-shadow-[0_4px_8px_rgba(0,242,254,0.6)]"></div>

    <canvas ref="canvasRef" class="w-[440px] h-[440px] drop-shadow-[0_12px_32px_rgba(0,0,0,0.6)]"></canvas>
  </div>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/web test`
Expected: PASS with 2 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components/Wheel3D.vue apps/web/src/composables
git commit -m "feat(web): implement Retina Canvas 3D physics wheel with sound sync"
```

---

### Task 11: Vue 3 3D Word Cloud, Activity Heatmap & Leaderboard Podiums

**Files:**
- Create: `apps/web/src/components/WordCloudSphere.vue`
- Create: `apps/web/src/components/ActivityHeatmap.vue`
- Create: `apps/web/src/components/LeaderboardPodium.vue`
- Create: `apps/web/src/views/DashboardView.vue`
- Test: `apps/web/tests/heatmap.test.ts`

**Interfaces:**
- Consumes: Fastify API endpoints (`/api/guilds/:guildId/leaderboard`, `/wordcloud`)
- Produces: Visual data representations with GPU acceleration and 3D tilts

- [ ] **Step 1: Write failing test for Heatmap coordinate calculation**

Create `apps/web/tests/heatmap.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';

export function calculateHeatmapColor(value: number, max: number): string {
  if (value === 0) return 'rgba(255, 255, 255, 0.05)';
  const ratio = Math.min(value / max, 1);
  return `rgba(0, 242, 254, ${0.2 + ratio * 0.8})`;
}

describe('Heatmap Color Ratio', () => {
  it('returns faint background for 0 activity', () => {
    expect(calculateHeatmapColor(0, 100)).toBe('rgba(255, 255, 255, 0.05)');
  });

  it('scales alpha dynamically with intensity', () => {
    const col = calculateHeatmapColor(50, 100);
    expect(col).toContain('rgba(0, 242, 254, 0.6)');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm --filter @sentinel/web test`
Expected: FAIL if test file has syntax or assertions

- [ ] **Step 3: Implement WordCloudSphere, ActivityHeatmap, and LeaderboardPodium**

Create `apps/web/src/components/LeaderboardPodium.vue`:
```vue
<script setup lang="ts">
import { Trophy } from 'lucide-vue-next';

defineProps<{
  podium: Array<{ username: string; avatar: string; score: number; rank: number }>;
}>();
</script>

<template>
  <div class="grid grid-cols-3 gap-4 items-end pt-8">
    <div
      v-for="user in podium"
      :key="user.rank"
      :class="[
        'glass-panel p-4 rounded-2xl flex flex-col items-center text-center transition-transform hover:-translate-y-2',
        user.rank === 1 ? 'border-amber-400/50 order-2 h-64' : user.rank === 2 ? 'border-slate-300/40 order-1 h-52' : 'border-amber-700/40 order-3 h-44'
      ]"
    >
      <div class="relative">
        <img :src="user.avatar || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + user.username" class="w-16 h-16 rounded-full border-2 border-cyan-400" />
        <div class="absolute -bottom-2 -right-2 p-1 rounded-full bg-space border border-white/20">
          <Trophy class="w-4 h-4 text-amber-400" />
        </div>
      </div>
      <span class="mt-3 font-bold text-base truncate w-full">{{ user.username }}</span>
      <span class="text-xs text-cyan-300 mt-1">{{ user.score }} pts</span>
    </div>
  </div>
</template>
```

Create `apps/web/src/components/ActivityHeatmap.vue`:
```vue
<script setup lang="ts">
defineProps<{
  matrix: number[][]; // 7 days x 24 hours
}>();

function getColor(val: number) {
  if (val === 0) return 'rgba(255, 255, 255, 0.05)';
  const alpha = Math.min(0.2 + val * 0.1, 1);
  return `rgba(0, 242, 254, ${alpha})`;
}
</script>

<template>
  <div class="glass-panel p-6 rounded-3xl">
    <h3 class="text-lg font-bold mb-4 flex items-center gap-2">
      <span class="w-2.5 h-2.5 rounded-full bg-cyan-400"></span>
      Biểu đồ Hoạt động Máy chủ (24h x 7 ngày)
    </h3>
    <div class="grid grid-rows-7 gap-1.5">
      <div v-for="(day, dIdx) in matrix" :key="dIdx" class="grid grid-cols-24 gap-1.5">
        <div
          v-for="(val, hIdx) in day"
          :key="hIdx"
          :style="{ backgroundColor: getColor(val) }"
          class="h-4 rounded-sm transition-transform hover:scale-125"
          :title="`Ngày ${dIdx + 1}, ${hIdx}h: ${val} hoạt động`"
        ></div>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm --filter @sentinel/web test`
Expected: PASS with 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/components
git commit -m "feat(web): implement LeaderboardPodium and ActivityHeatmap components"
```

---

### Task 12: Deployment Scaffolding, Secrets Hygiene & Verification

**Files:**
- Create: `ecosystem.config.js`
- Create: `scripts/setup-vps.sh`
- Create: `apps/bot/src/index.ts`
- Modify: `.gitignore`
- Test: `tests/e2e/sanity.test.ts`

**Interfaces:**
- Consumes: All workspaces
- Produces: Production deployment scripts, master entry point, PM2 config

- [ ] **Step 1: Write failing e2e sanity check verifying all workspaces compile clean**

Create `tests/e2e/sanity.test.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

describe('Production Readiness & Secrets Hygiene', () => {
  it('ensures .env is strictly ignored in .gitignore', () => {
    const gitignore = fs.readFileSync(path.resolve(__dirname, '../../.gitignore'), 'utf8');
    expect(gitignore).toContain('.env');
  });

  it('ensures .env.example contains zero raw secrets', () => {
    const envExample = fs.readFileSync(path.resolve(__dirname, '../../.env.example'), 'utf8');
    expect(envExample).not.toContain('mongodb+srv://admin:');
    expect(envExample).toContain('DISCORD_TOKEN=your_bot_token_here');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm test`
Expected: FAIL if .gitignore or files missing

- [ ] **Step 3: Implement master entry point, PM2 config, and VPS script**

Create `apps/bot/src/index.ts`:
```typescript
import dotenv from 'dotenv';
dotenv.config();

import { Client, GatewayIntentBits } from 'discord.js';
import { connectDatabase } from './models/database';
import { buildFastifyServer } from './api/server';
import { governorManager } from './governor/GovernorManager';
import { VoiceService } from './services/voice/VoiceService';
import { AnalyticsService } from './services/analytics/AnalyticsService';
import { ReminderService } from './services/reminder/ReminderService';
import { scheduleWeeklyReports } from './services/analytics/WeeklyReportCron';
import { handleRandomWheelCommand } from './commands/random';

async function bootstrap() {
  console.log('🚀 Initializing Sentinel Bot ecosystem...');

  // 1. Database Connection
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.warn('⚠️ MONGODB_URI not provided. Skipping database connection.');
  } else {
    await connectDatabase(mongoUri);
    console.log('✅ Connected to MongoDB Atlas (DNE_BotDiscord)');
  }

  // 2. Start Anti-Idle CPU Governor
  governorManager.start();
  console.log('⚡ Adaptive CPU Governor worker started (Target: 22%-27% CPU)');

  // 3. Fastify REST & WebSocket API
  const apiServer = buildFastifyServer();
  const port = Number(process.env.PORT) || 3000;
  await apiServer.listen({ port, host: '0.0.0.0' });
  console.log(`🌐 Fastify API & WebSocket listening on port ${port}`);

  // 4. Discord Bot Client
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent
    ]
  });

  client.once('ready', () => {
    console.log(`🤖 Discord Bot logged in as ${client.user?.tag}`);
    ReminderService.startPolling(client);
    scheduleWeeklyReports(client);
  });

  client.on('voiceStateUpdate', VoiceService.handleVoiceStateUpdate);
  client.on('messageCreate', AnalyticsService.handleMessage);

  client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'random') {
      await handleRandomWheelCommand(interaction);
    }
  });

  if (process.env.DISCORD_TOKEN) {
    await client.login(process.env.DISCORD_TOKEN);
  } else {
    console.warn('⚠️ DISCORD_TOKEN not provided. Bot gateway disabled.');
  }
}

bootstrap().catch((err) => {
  console.error('Fatal initialization error:', err);
  process.exit(1);
});
```

Create `ecosystem.config.js`:
```javascript
module.exports = {
  apps: [
    {
      name: 'sentinel-bot',
      script: 'apps/bot/dist/index.js',
      node_args: '--max-old-space-size=400',
      instances: 1,
      autorestart: true,
      max_memory_restart: '350M',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
```

Create `scripts/setup-vps.sh`:
```bash
#!/usr/bin/env bash
set -e

echo "=== Sentinel Bot: Oracle VPS Setup Script ==="

# 1. Setup 2GB Swap Memory
if [ ! -f /swapfile ]; then
  echo "Setting up 2GB swapfile..."
  sudo fallocate -l 2G /swapfile
  sudo chmod 600 /swapfile
  sudo mkswap /swapfile
  sudo swapon /swapfile
  echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
  echo "Swap configured successfully."
else
  echo "Swapfile already exists."
fi

# 2. Install Node.js 20 LTS & pnpm
if ! command -v node &> /dev/null; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

sudo npm install -g pnpm pm2

echo "=== VPS Setup Complete ==="
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm test`
Expected: ALL tests pass across all workspaces.

- [ ] **Step 5: Commit**

```bash
git add ecosystem.config.js scripts/setup-vps.sh apps/bot/src/index.ts tests/e2e/sanity.test.ts
git commit -m "chore(ops): add deployment scaffolding, PM2 config, and VPS setup script"
```
