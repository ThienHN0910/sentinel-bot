# Architecture Design Document: Sentinel Bot & Cyber Web Dashboard

- **Project:** Sentinel Bot (`sentinel-bot`)
- **Date:** 2026-09-27
- **Database Name:** `DNE_BotDiscord` (MongoDB Atlas Free Tier)
- **Host Target:** Oracle Cloud Always Free AMD VPS (1 vCPU, 1 GB RAM)
- **Frontend Target:** Vue 3 Deployed on Vercel / Cloudflare Pages

---

## 1. Executive Summary & Problem Context

Sentinel Bot is a full-stack Discord Bot and Web Dashboard ecosystem designed to fulfill two critical objectives:
1. **Community Automation & Engagement:** Comprehensive tracking of voice time, chat messages, images, word/mention frequencies, automated weekly reports, user reminders, leveling (XP), server economy (DNE Coin), multiplayer mini-games (Nối từ, Bầu cua, Xì dách), and a synchronous 3D Random Wheel spinner (`/random wheel`).
2. **Oracle Cloud Anti-Idle Compute Protection:** Oracle Cloud Always Free instances are subject to automated reclamation if 95th percentile CPU utilization falls below 20% over 7 rolling days. The bot integrates a low-memory, high-precision **Adaptive Duty-Cycle CPU Governor** running in an isolated Worker Thread to strictly maintain 22%–27% CPU utilization 24/7 without starving the Node.js event loop, dropping Discord gateway heartbeats, or overflowing the 1 GB VPS RAM limit.

---

## 2. System Architecture & Monorepo Topology

The project is structured as a **pnpm Monorepo** containing three workspaces:

```
sentinel-bot/
├── apps/
│   ├── bot/                          # Backend: Discord Bot, CPU Governor, Fastify API
│   │   ├── src/
│   │   │   ├── api/                  # Fastify server, routes, JWT auth, WebSocket handler
│   │   │   ├── commands/             # Discord slash commands (/random, /rank, /stats, /remind,...)
│   │   │   ├── events/               # Discord gateway events (ready, messageCreate, voiceStateUpdate,...)
│   │   │   ├── governor/             # Adaptive CPU Governor worker thread & feedback controller
│   │   │   ├── models/               # Mongoose schemas for MongoDB Atlas
│   │   │   ├── services/             # VoiceService, AnalyticsService, EconomyService, GameService
│   │   │   └── index.ts              # Master initialization & graceful shutdown
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── web/                          # Frontend: Vue 3 Cyber Dashboard & 3D Wheel
│       ├── src/
│       │   ├── assets/               # Audio SFX (wheel clicks, fanfare), textures
│       │   ├── components/           # Wheel3D, WordCloudSphere, ActivityHeatmap, LeaderboardPodium
│       │   ├── composables/          # useWheelSocket, useSound, useAuth
│       │   ├── stores/               # Pinia stores (auth, guild, wheel)
│       │   ├── views/                # DashboardView, WheelView, LeaderboardView, SettingsView
│       │   └── App.vue
│       ├── package.json
│       ├── vite.config.ts
│       └── tailwind.config.js
│
├── packages/
│   └── shared/                       # Cross-workspace contracts, DTOs, Enums, Types
│       ├── src/
│       │   ├── types/                # UserStats, GuildConfig, WheelPayload, GameState
│       │   └── constants/            # XP curve, Economy rewards, Stop words
│       ├── package.json
│       └── tsconfig.json
│
├── docs/                             # Architecture specifications & implementation plans
├── .env.example                      # Zero-leakage environment variable template
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. Oracle Cloud Free VPS Anti-Idle Governor Specification

### 3.1 Hardware Environment & Constraints
- **Processor:** 1 vCPU (AMD E2.1.Micro)
- **Memory:** 1 GB Physical RAM
- **Reclamation Metric:** 95th percentile CPU utilization < 20% over 7 days triggers reclamation.
- **Node.js Memory Bound:** V8 heap restricted via `--max-old-space-size=400`.
- **System Memory Buffer:** 2 GB Linux swapfile (`/swapfile`) to prevent OOM-killer termination.

### 3.2 Adaptive Duty-Cycle Engine
The CPU Governor runs in an isolated `worker_threads` instance (`cpuGovernor.worker.ts`). The main thread and the worker communicate via non-blocking message ports.

```
+-------------------------------------------------------------------------+
| Host OS Linux 1 vCPU                                                    |
|                                                                         |
|  [Main Thread]                                 [Worker Thread]          |
|  Node.js Event Loop                            Adaptive Duty-Cycle      |
|  - Discord.js Gateway (1-3%)                   - Cycle Window: 100ms    |
|  - Fastify HTTP & WS (1-2%)                    - Busy compute: T_busy   |
|  - Voice Audio Stream (3-8%)                   - Sleep: 100ms - T_busy  |
|                                                                         |
|         ▲                                                │              |
|         │                                                ▼              |
|         └─────────────── [Feedback Loop Controller] ─────┘              |
|                          Samples os.cpus() every 5s                     |
|                          Target Total CPU: 24% (Tolerance: ±2%)         |
+-------------------------------------------------------------------------+
```

1. **Duty Cycle Window:** $T_{window} = 100\,\text{ms}$.
2. **Dynamic Work Allocation:** During $T_{busy}$, the worker runs micro-cryptographic hashes (SHA-256 rounds). For the remainder $T_{sleep} = T_{window} - T_{busy}$, it suspends using `Atomics.wait` on a `SharedArrayBuffer` (consuming 0% CPU during sleep).
3. **Closed-Loop Feedback Controller:**
   - Every 5 seconds, the controller samples CPU tick metrics across all cores.
   - If Total Host CPU < 22%: Increase $T_{busy}$ by step $\Delta = 2\,\text{ms}$.
   - If Total Host CPU > 26%: Decrease $T_{busy}$ by step $\Delta = 3\,\text{ms}$.
   - If Total Host CPU > 35% (e.g., active voice stream or heavy NLP parsing): Immediately suspend $T_{busy} = 0\,\text{ms}$ until host load normalizes.
4. **Memory Footprint:** The worker allocates less than 15 MB RSS.

---

## 4. Discord Bot Subsystems (`apps/bot`)

### 4.1 Voice Tracking & TTS Welcome Engine (`VoiceService`)
- **Tracking:** Subscribes to `voiceStateUpdate`.
  - When user joins a voice channel: Records timestamp `joinTime`.
  - When user leaves or deafens: Computes duration $\Delta t = \text{leaveTime} - \text{joinTime}$, persists to MongoDB, awards $10\,\text{EXP} + 5\,\text{Coins}$ per 5 minutes.
- **TTS Greeting:**
  - On user join (and user is not a bot, and not switching channels):
  - Fetches TTS MP3 audio stream via Google Translate TTS API in Vietnamese.
  - Spawns `@discordjs/voice` AudioPlayer, joins channel, plays greeting (duration ~3s).
  - Immediately destroys audio resource and unlinks ffmpeg buffer upon `AudioPlayerStatus.Idle` to free memory.

### 4.2 Message, Image & Word Frequency Analytics (`AnalyticsService`)
- **Chat Tracking:** Subscribes to `messageCreate`.
  - Increments `totalMessages`.
  - Scans `message.attachments`: If MIME type is image (`image/png`, `image/jpeg`, etc.), increments `totalImages`.
- **NLP & Word Frequency Analysis:**
  - Tokenizes message body, converts to lowercase, strips punctuation and URLs.
  - Filters out Vietnamese and English stop-words (`là`, `và`, `của`, `được`, `the`, `a`, etc.).
  - Upserts word counts to `WordStat` collection using batched MongoDB operations.
  - Extracts user mentions (`<@!userId>`) to increment `mentionedUsers` interaction matrix.
- **Weekly Automated Report:**
  - Scheduled via `node-cron` every Monday at `00:00:00`.
  - Aggregates top 3 voice champions, top 3 chat contributors, top 3 image uploaders, and top 5 trending words of the week.
  - Formats a visual Discord Embed sent to the guild's designated announcement channel.

### 4.3 Leveling (XP) & Economy Subsystem (`EconomyService`, `LevelService`)
- **Leveling:**
  - Formula: $\text{EXP required for Level } L = 100 \times L^{1.5}$.
  - Chat reward: 15–25 EXP per message with a 60-second cooldown per user.
  - Slash command `/rank`: Generates a user rank card showing avatar, level, EXP bar, and server standing.
- **Economy:**
  - Slash command `/daily`: Grants 100–250 DNE Coins with streak multiplier ($+10\%$ per consecutive day, capped at 7 days).
  - Slash command `/balance`: Displays current wallet and streak status.
  - Slash command `/transfer [target] [amount]`: Secure peer-to-peer coin transfer with atomic MongoDB balance updates.

### 4.4 Reminders Subsystem (`ReminderService`)
- **Slash command `/remind [time] [reason]`**: Supports relative durations (`10m`, `2h`, `1d`) and absolute timestamps (`20:30`).
- **Execution:** Persistent MongoDB records polled every 30 seconds. Upon trigger, the bot sends a direct mention in the original channel and flags status as `completed`.

### 4.5 Multiplayer Mini-Games & Random Wheel (`GameService`)
- **`/random wheel [items]`**:
  - Initializes a `WheelSession` in MongoDB with a unique session ID.
  - Returns a Discord embed featuring:
    1. Interactive Button `[ Quay Nhanh trên Discord ]`: Animates an in-Discord progress text/embed and declares winner.
    2. Interactive Button `[ Mở Vòng Quay 3D trên Web ]`: Direct link to `https://<frontend-domain>/wheel?session=<id>`.
- **Nối từ tiếng Việt (Word Chain):** Guild channel game maintaining state of the last spoken word and validating against a Vietnamese lexical set.
- **Bầu Cua Tôm Cá:** Multiplayer betting rounds (Bầu, Cua, Tôm, Cá, Gà, Nai) funded by DNE Coins, resolved with cryptographic dice rolls.
- **Xì Dách (Blackjack):** Player vs Dealer card game using Discord button components for `Hit`, `Stand`, and `Double`.

---

## 5. Fastify REST & WebSocket API Specification

### 5.1 Endpoints Specification

| Method | Path | Auth | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Returns uptime, gateway ping, host CPU%, and RSS memory |
| `GET` | `/api/guilds/:guildId/leaderboard` | Public | Leaderboard for Voice, Chat, Images, and Level |
| `GET` | `/api/guilds/:guildId/wordcloud` | Public | Aggregated word frequencies and top mentions |
| `GET` | `/api/guilds/:guildId/activity` | Public | 24-hour x 7-day activity heatmap dataset |
| `GET` | `/api/wheel/:sessionId` | Public | Retrieves wheel title, items, colors, and winner state |
| `POST` | `/api/wheel` | Optional Auth | Creates a new wheel session |
| `GET` | `/api/auth/discord/login` | Public | Initiates Discord OAuth2 flow |
| `GET` | `/api/auth/discord/callback` | Public | Exchanges code for access token, issues JWT session |
| `GET` | `/api/user/me` | JWT | Returns user profile, coins, stats, and active reminders |
| `GET` | `/api/user/reminders` | JWT | Lists personal reminders |
| `POST` | `/api/user/reminders` | JWT | Creates a new reminder from the Web Dashboard |
| `DELETE` | `/api/user/reminders/:id` | JWT | Cancels a pending reminder |
| `PATCH` | `/api/guilds/:guildId/settings` | JWT (Admin) | Updates guild settings (TTS toggle, welcome prompt) |

### 5.2 Real-time WebSocket Protocol (`/ws/wheel/:sessionId`)
All connected clients in the same session room receive synchronized state:

```json
// Server -> Clients: SPIN_START
{
  "event": "SPIN_START",
  "targetIndex": 4,
  "targetAngle": 1420.5,
  "durationMs": 6500,
  "startedAt": 1727421600000
}

// Server -> Clients: SPIN_END
{
  "event": "SPIN_END",
  "winner": "Giải Nhất - 500 DNE Coins",
  "targetIndex": 4
}
```

---

## 6. Vue 3 Web Dashboard Design & Aesthetics

### 6.1 Visual Aesthetics (Cyber-Glassmorphism & Depth 10/10)
- **Theme Palette:**
  - Base Background: `#0A0B10` (Deep Obsidian Space)
  - Surface Glass: `rgba(20, 24, 38, 0.65)` with `backdrop-filter: blur(16px)`
  - Border Accents: `rgba(255, 255, 255, 0.08)` to `linear-gradient(135deg, #00F2FE 0%, #7F00FF 100%)`
  - Typography: Inter / Plus Jakarta Sans with tabular figures for real-time counters.
- **Performance Rule:** 100% of transitions and animations strictly use GPU-accelerated CSS properties (`transform: translate3d(...)`, `opacity`, `scale`). Layout-triggering properties (`top`, `left`, `width`, `height`, `margin`) are prohibited in animation loops.

### 6.2 Key Interactive Visual Components
1. **`Wheel3D.vue` (Retina Canvas Physics Wheel):**
   - High-DPI canvas rendering (`devicePixelRatio`).
   - Dynamic slices with neon gradients, drop shadows, and bevel embossing.
   - Deceleration curve calculated via Cubic-Bezier ease-out simulation.
   - Spring-loaded flapper (pointer): Flapper visually bends and snaps back on each slice peg, playing an audio tick sound synced via Web Audio API.
   - Victory reveal: Multi-stage burst via `canvas-confetti` + 3D elastic modal popup.
2. **`WordCloudSphere.vue` (3D Interactive Word Sphere):**
   - Renders word tokens onto a spherical coordinate system.
   - Supports continuous auto-rotation and interactive mouse/touch drag in 3D space.
   - Font scale and luminosity proportional to message frequency.
3. **`LeaderboardPodium.vue`:**
   - 3D perspective cards with cursor-following tilt effect (`perspective(1000px) rotateX(...) rotateY(...)`).
   - Animated shimmer sweep on EXP level progress bars.
4. **`ActivityHeatmap.vue`:**
   - 24-hour horizontal axis by 7-day vertical axis matrix visualizing guild activity density.
5. **`DensitySwitcher`:**
   - Instant toggle between **Immersive Mode** (maximum visual depth, full 3D components) and **Compact Mode** (high data density, condensed metric tables).

---

## 7. Database Schemas (`DNE_BotDiscord`)

```typescript
// Guild Configuration Schema
interface IGuildConfig {
  guildId: string; // Unique Index
  name: string;
  welcomeVoiceTts: boolean;
  welcomeMessage: string;
  reportChannelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

// User Statistics & Economy Schema
interface IUserStat {
  guildId: string; // Compound Index with userId (unique)
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
  mentionedUsers: Map<string, number>;
  updatedAt: Date;
}

// Word & Mention Analytics Schema
interface IWordStat {
  guildId: string; // Compound Index with word
  word: string;
  count: number;
  lastSeenAt: Date; // TTL Index for 60-day auto-purge
}

// Reminder Schema
interface IReminder {
  userId: string;
  guildId: string;
  channelId: string;
  message: string;
  remindAt: Date; // Compound Index with status
  status: 'pending' | 'completed' | 'cancelled';
  createdAt: Date;
}

// Wheel Session Schema
interface IWheelSession {
  sessionId: string; // Unique Index (Nanoid)
  guildId: string;
  createdBy: string;
  title: string;
  items: Array<{ label: string; color: string; weight?: number }>;
  winner?: string;
  isCompleted: boolean;
  createdAt: Date; // TTL Index for 24-hour auto-purge
}
```

---

## 8. Security Hygiene & Secrets Management

- **Zero-Leakage Guarantee:** Absolutely no bot tokens, MongoDB credentials, or JWT secrets are committed to Git.
- **Environment Schema (`.env.example`):**

```bash
# Discord Credentials
DISCORD_TOKEN=your_bot_token_here
DISCORD_CLIENT_ID=your_client_id_here
DISCORD_CLIENT_SECRET=your_client_secret_here

# MongoDB Atlas Database
MONGODB_URI=mongodb+srv://<username>:<password>@cluster.mongodb.net/DNE_BotDiscord?retryWrites=true&w=majority

# API & Security
PORT=3000
JWT_SECRET=replace_with_a_cryptographically_secure_random_string_32_chars
FRONTEND_URL=https://your-app.vercel.app

# Frontend Web (.env for apps/web)
VITE_API_URL=https://api.yourdomain.com
VITE_WS_URL=wss://api.yourdomain.com
```

- **`.gitignore` Compliance:** `.env`, `.env.*`, `dist`, `node_modules`, and `.turbo` are ignored across all workspaces.

---

## 9. Deployment & Operations Strategy

### 9.1 Oracle Cloud Free Tier VPS Setup (1 vCPU, 1 GB RAM)
1. **Swap Memory Configuration:**
   ```bash
   sudo fallocate -l 2G /swapfile
   sudo chmod 600 /swapfile
   sudo mkswap /swapfile
   sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```
2. **Process Management (PM2):**
   ```javascript
   // ecosystem.config.js
   module.exports = {
     apps: [{
       name: 'sentinel-bot',
       script: 'dist/index.js',
       cwd: '/home/ubuntu/sentinel-bot/apps/bot',
       node_args: '--max-old-space-size=400',
       instances: 1,
       autorestart: true,
       env: {
         NODE_ENV: 'production'
       }
     }]
   };
   ```
3. **Public API Connectivity via Cloudflare Tunnel:**
   - Install `cloudflared` on VPS.
   - Route `api.yourdomain.com` $\rightarrow$ `http://localhost:3000` with zero exposed public inbound ports.

### 9.2 Frontend Hosting (Vercel / Cloudflare Pages)
- Root Directory: `apps/web`
- Build Command: `pnpm build`
- Output Directory: `dist`
- Environment Variables: `VITE_API_URL`, `VITE_WS_URL`

---

## 10. Verification & Quality Assurance Strategy

1. **CPU Governor Verification:** Run local benchmark monitoring `top` / `htop` to confirm host CPU load remains constrained between 22%–27% with zero spikes above 35% during sleep cycles.
2. **Memory Leak Testing:** Run a 2-hour continuous test simulating chat spam and voice join events, verifying RSS stays strictly below 250 MB.
3. **Discord Gateway Resilience:** Verify WebSocket reconnection handles network interruptions gracefully with zero data corruption.
4. **Synchronous Wheel Verification:** Connect multiple browser tabs and trigger `/random wheel`, confirming identical angular deceleration and simultaneous winner announcement.
5. **Type Safety & Build Verification:** Strict TypeScript compilation with `pnpm build` across all packages and apps with zero errors.
