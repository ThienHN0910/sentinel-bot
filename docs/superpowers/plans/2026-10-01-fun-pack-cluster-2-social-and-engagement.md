# Fun Pack Cluster 2: Social & Engagement (Confession, Bet, QOTD) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/confess` (zero-trace anonymous confession with Modal & DM input), `/bet` (1v1 P2P challenge and community pool wagers with escrow protection), and `/qotd` (automated daily question rotation for WYR, This/That, and Trivia with DNE Coin/XP rewards).

**Architecture:** Maintain thin Discord controllers delegating to specialized domain services. `ConfessionService` strictly enforces Zero-Trace Anonymity (never persists author IDs). `BetService` manages escrow lifecycle and payout distribution using atomic transactions in `EconomyService`. `DailyQuestionService` manages the Vietnamese question bank, scheduled daily cron delivery, and interactive vote/trivia resolution.

**Tech Stack:** TypeScript 5.5, discord.js 14, MongoDB/Mongoose 8.5, node-cron 3.0, Vitest 2.0.

**Spec:** `docs/superpowers/specs/2026-10-01-fun-pack-design.md`

## Global Constraints

- **Zero-Trace Anonymity:** `ConfessionModel` and logs must NEVER record `userId`, `authorId`, IP hash, or any identifier linking a message to a sender.
- **Financial Integrity & Escrow:** All coin wagers and payouts must use atomic balance checks and MongoDB transactions to avoid overdraft or race condition exploits.
- **Security & Secrets Hygiene:** Zero API keys, bot tokens, or webhook credentials in code or version control.
- **Timezone Standardization:** All cron jobs and daily resets run in `Asia/Ho_Chi_Minh` (UTC+7).
- **Graceful Error Handling:** Rejection of DMs for server-only commands, friendly ephemeral error messages, and deferral before async DB operations.

---

## File map

- `packages/shared/src/types/index.ts`: Add domain types for Confession (`IConfession`), Bet (`IBet`, `Wager`, `BetKind`, `BetStatus`), QOTD (`IDailyQuestion`, `QuestionType`), and update `IGuildConfig`.
- `packages/shared/src/constants/questions.json`: Built-in Vietnamese question bank for WYR, This/That, and Trivia.
- `apps/bot/src/models/GuildConfig.ts`: Add `confessionChannelId?: string` and `qotdChannelId?: string`.
- `apps/bot/src/models/Confession.ts`: Mongoose schema with `guildId`, `confessionNumber`, `content`, `messageId`, `createdAt` (no author fields).
- `apps/bot/src/models/Bet.ts`: Schema for P2P and pool bets, wagers, escrow totals, and outcomes.
- `apps/bot/src/models/DailyQuestion.ts`: Schema tracking daily question deliveries, interactive votes, and rewarded users.
- `apps/bot/src/services/confession/ConfessionService.ts`: Core confession logic, per-guild sequence numbering, rate limiting, and webhook/embed publishing.
- `apps/bot/src/commands/confess.ts`: Slash command `/confess` (Modal popup and `/confess delete` subcommand).
- `apps/bot/src/services/betting/BetService.ts`: Escrow wager management, P2P acceptance/resolution, and pari-mutuel pool calculations.
- `apps/bot/src/commands/bet.ts`: Slash command `/bet` (challenge, accept, pool, join, resolve).
- `apps/bot/src/services/qotd/DailyQuestionService.ts`: Question rotation, cron runner, button interaction vote recording, and trivia reward distribution.
- `apps/bot/src/commands/qotd.ts`: Slash command `/qotd` for manual trigger, viewing today's question, and admin channel configuration.
- `apps/bot/src/events/messageCreate.ts`: Handle direct messages to bot to initiate private confession flow.
- `apps/bot/src/events/ready.ts`, `apps/bot/src/events/interactionCreate.ts`: Register commands, modals, buttons, and handlers.
- `apps/web/src/content/commands.ts`: Update command documentation.
- Test suites: `confessionService.test.ts`, `confessCommand.test.ts`, `betService.test.ts`, `qotdService.test.ts`, `cluster2Router.test.ts`.

---

### Task 1: Confession Core & Zero-Trace Persistence

**Files:**
- Modify: `packages/shared/src/types/index.ts`
- Modify: `apps/bot/src/models/GuildConfig.ts`
- Create: `apps/bot/src/models/Confession.ts`
- Create: `apps/bot/src/services/confession/ConfessionService.ts`
- Test: `apps/bot/tests/confessionService.test.ts`

**Interfaces:**
```ts
// packages/shared/src/types/index.ts
export interface IConfession {
  guildId: string;
  confessionNumber: number;
  content: string;
  messageId: string;
  createdAt: Date;
}
```

```ts
// apps/bot/src/services/confession/ConfessionService.ts
export class ConfessionService {
  public static checkRateLimit(userId: string, now?: Date): { allowed: boolean; retryAfterSeconds: number };
  public static async postConfession(params: {
    guildId: string;
    content: string;
    client: Client;
  }): Promise<{ confessionNumber: number; messageId: string }>;
  public static async deleteConfession(params: {
    guildId: string;
    confessionNumber: number;
    client: Client;
  }): Promise<boolean>;
}
```

- [ ] **Step 1: Write failing tests in `apps/bot/tests/confessionService.test.ts`.**
  Assert:
  - `ConfessionModel` schema validation confirms absence of `userId` or `authorId`.
  - Sequential confession numbers auto-increment per guild (1, 2, 3...).
  - `checkRateLimit` enforces 5-minute in-memory cooldown per user without recording user identity in DB.
  - `postConfession` formats embed with header `📬 Confession #N` and adds reaction buttons (❤️, 😂, 💬).
  - `deleteConfession` deletes message from Discord channel and deletes DB record.
- [ ] **Step 2: Run test to verify failure.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/confessionService.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement schema, types, and `ConfessionService.ts`.**
  Add `confessionChannelId` to `GuildConfigModel`. Implement auto-increment numbering using atomic query on `ConfessionModel`. Implement Discord channel message dispatch with interactive reaction buttons.
- [ ] **Step 4: Run test to verify it passes.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/confessionService.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit changes.**
  ```bash
  git add packages/shared/src/types/index.ts apps/bot/src/models/GuildConfig.ts apps/bot/src/models/Confession.ts apps/bot/src/services/confession/ConfessionService.ts apps/bot/tests/confessionService.test.ts
  git commit -m "feat(bot): implement zero-trace confession service and model"
  ```

---

### Task 2: `/confess` Command, Modal Submission, and DM Confession Listener

**Files:**
- Create: `apps/bot/src/commands/confess.ts`
- Modify: `apps/bot/src/events/messageCreate.ts`
- Modify: `apps/bot/src/events/interactionCreate.ts`
- Test: `apps/bot/tests/confessCommand.test.ts`

**Interfaces:**
```ts
// apps/bot/src/commands/confess.ts
export async function handleConfessCommand(interaction: ChatInputCommandInteraction): Promise<void>;
export async function handleConfessModalSubmit(interaction: ModalSubmitInteraction): Promise<void>;
export async function handleConfessButton(interaction: ButtonInteraction): Promise<void>;
export async function handleDirectMessageConfession(message: Message): Promise<void>;
```

- [ ] **Step 1: Write failing tests in `apps/bot/tests/confessCommand.test.ts`.**
  Assert:
  - Running `/confess` in guild shows Modal with text input `content` (min 10, max 1000 chars).
  - Submitting modal validates rate-limit and posts confession via `ConfessionService`, replying with ephemeral success message.
  - Submitting `/confess delete number:N` requires `ManageGuild` permission and calls `deleteConfession`.
  - Sending a DM to bot when user shares 1 guild sends interactive server-select confirmation; clicking `[Gửi]` dispatches confession.
  - Clicking reaction buttons (❤️, 😂, 💬) updates button counters ephemerally without persisting voter identities.
- [ ] **Step 2: Run test to verify failure.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/confessCommand.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement `confess.ts`, update `messageCreate.ts`, and wire modal/button handlers in `interactionCreate.ts`.**
  Implement modal display, DM listener with action row buttons, rate-limit rejection, and admin delete command.
- [ ] **Step 4: Run test to verify it passes.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/confessCommand.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit changes.**
  ```bash
  git add apps/bot/src/commands/confess.ts apps/bot/src/events/messageCreate.ts apps/bot/src/events/interactionCreate.ts apps/bot/tests/confessCommand.test.ts
  git commit -m "feat(bot): add /confess modal, dm confession flow, and admin controls"
  ```

---

### Task 3: Betting Engine (P2P Challenge & Community Pool Wagers)

**Files:**
- Modify: `packages/shared/src/types/index.ts`
- Create: `apps/bot/src/models/Bet.ts`
- Create: `apps/bot/src/services/betting/BetService.ts`
- Create: `apps/bot/src/commands/bet.ts`
- Test: `apps/bot/tests/betService.test.ts`

**Interfaces:**
```ts
// packages/shared/src/types/index.ts
export type BetKind = 'p2p' | 'pool';
export type BetStatus = 'open' | 'active' | 'locked' | 'resolved' | 'cancelled';

export interface IBet {
  betId: string;
  guildId: string;
  kind: BetKind;
  creatorId: string;
  opponentId?: string;
  title: string;
  options: string[];
  wagers: Array<{ userId: string; option: string; amount: number; createdAt: Date }>;
  status: BetStatus;
  winnerOption?: string;
  winnerUserId?: string;
  totalPool: number;
  expiresAt: Date;
  resolvedAt?: Date;
}
```

```ts
// apps/bot/src/services/betting/BetService.ts
export class BetService {
  public static async createP2PChallenge(params: {
    guildId: string;
    creatorId: string;
    creatorUsername: string;
    opponentId: string;
    amount: number;
    title: string;
    creatorPick: string;
  }): Promise<IBet>;

  public static async acceptP2PChallenge(params: {
    betId: string;
    opponentId: string;
    opponentUsername: string;
  }): Promise<IBet>;

  public static async resolveP2PChallenge(params: {
    betId: string;
    callerId: string;
    winnerUserId: string;
  }): Promise<{ winnerId: string; payout: number }>;

  public static async createCommunityPool(params: {
    guildId: string;
    creatorId: string;
    title: string;
    options: string[];
    durationMs: number;
  }): Promise<IBet>;

  public static async joinCommunityPool(params: {
    betId: string;
    userId: string;
    username: string;
    option: string;
    amount: number;
  }): Promise<IBet>;

  public static async resolveCommunityPool(params: {
    betId: string;
    callerId: string;
    winningOption: string;
  }): Promise<{ winningOption: string; totalWinners: number; totalPayout: number }>;
}
```

- [ ] **Step 1: Write failing tests in `apps/bot/tests/betService.test.ts`.**
  Assert:
  - Creating a challenge checks user balance and deducts escrow coins atomically.
  - Accepting a challenge deducts opponent coins into escrow; rejecting/cancelling refunds escrow coins.
  - Resolving P2P awards total 2x pot to winner.
  - Joining community pool aggregates bets; resolving calculates correct pari-mutuel proportion for all winners.
  - Insufficient funds rejection on both challenge and join.
  - Unauthorized caller cannot resolve bet.
- [ ] **Step 2: Run test to verify failure.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/betService.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement `Bet.ts`, `BetService.ts`, and `apps/bot/src/commands/bet.ts`.**
  Implement atomic coin deductions via `EconomyService` (or direct transaction updates on `UserStatModel`). Implement slash command `/bet` with subcommands: `challenge`, `accept`, `pool create`, `join`, `resolve`.
- [ ] **Step 4: Run test to verify it passes.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/betService.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit changes.**
  ```bash
  git add packages/shared/src/types/index.ts apps/bot/src/models/Bet.ts apps/bot/src/services/betting/BetService.ts apps/bot/src/commands/bet.ts apps/bot/tests/betService.test.ts
  git commit -m "feat(bot): implement betting system for 1v1 challenges and community pools"
  ```

---

### Task 4: Daily Question System (`/qotd` & Question Bank & Cron)

**Files:**
- Create: `packages/shared/src/constants/questions.json`
- Modify: `packages/shared/src/types/index.ts`
- Modify: `apps/bot/src/models/GuildConfig.ts`
- Create: `apps/bot/src/models/DailyQuestion.ts`
- Create: `apps/bot/src/services/qotd/DailyQuestionService.ts`
- Create: `apps/bot/src/commands/qotd.ts`
- Test: `apps/bot/tests/qotdService.test.ts`

**Interfaces:**
```ts
// packages/shared/src/types/index.ts
export type QuestionType = 'wyr' | 'this_that' | 'trivia';

export interface IDailyQuestion {
  guildId: string;
  date: string; // YYYY-MM-DD
  type: QuestionType;
  question: string;
  options: Array<{ key: string; label: string; votes: string[] }>;
  correctAnswerKey?: string;
  rewardedUserIds: string[];
  messageId: string;
  channelId: string;
}
```

```ts
// apps/bot/src/services/qotd/DailyQuestionService.ts
export class DailyQuestionService {
  public static getRandomQuestion(excludedIds?: string[]): any;
  public static async postDailyQuestion(guildId: string, client: Client, forceQuestion?: any): Promise<IDailyQuestion>;
  public static async recordVote(params: {
    guildId: string;
    messageId: string;
    userId: string;
    optionKey: string;
  }): Promise<{ success: boolean; isCorrect?: boolean; rewardEarned?: boolean }>;
  public static startDailyCron(client: Client): CronJob;
}
```

- [ ] **Step 1: Write failing tests in `apps/bot/tests/qotdService.test.ts`.**
  Assert:
  - Question bank contains valid WYR, This/That, and Trivia questions in Vietnamese.
  - Posting question creates embed with action row buttons.
  - Recording vote for WYR/This/That adds user vote and prevents double-voting.
  - Selecting correct answer in Trivia immediately awards 50 DNE Coins + 20 XP to `UserStat` (awarded only once per user).
  - Cron trigger selects channel from `GuildConfigModel.qotdChannelId` and delivers once per calendar day.
- [ ] **Step 2: Run test to verify failure.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/qotdService.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement `questions.json`, `DailyQuestion.ts`, `DailyQuestionService.ts`, and `qotd.ts`.**
  Implement question loader, interactive button handler with live vote count percentages, trivia rewards, and slash command `/qotd` (`today`, `config channel`, `post`).
- [ ] **Step 4: Run test to verify it passes.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/qotdService.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit changes.**
  ```bash
  git add packages/shared/src/constants/questions.json packages/shared/src/types/index.ts apps/bot/src/models/GuildConfig.ts apps/bot/src/models/DailyQuestion.ts apps/bot/src/services/qotd/DailyQuestionService.ts apps/bot/src/commands/qotd.ts apps/bot/tests/qotdService.test.ts
  git commit -m "feat(bot): implement qotd daily question service with trivia rewards and cron"
  ```

---

### Task 5: Router Integration, Cron Initialization, and Documentation

**Files:**
- Modify: `apps/bot/src/commands/index.ts`
- Modify: `apps/bot/src/events/ready.ts`
- Modify: `apps/bot/src/events/interactionCreate.ts`
- Modify: `apps/bot/src/index.ts` (start QOTD cron on startup)
- Modify: `apps/web/src/content/commands.ts`
- Create: `apps/bot/tests/cluster2Router.test.ts`

- [ ] **Step 1: Write integration tests in `apps/bot/tests/cluster2Router.test.ts`.**
  Assert:
  - All commands (`confess`, `bet`, `qotd`) are exported in `commands/index.ts`.
  - Slash command definitions for all 3 commands are in `ready.ts`.
  - Button interactions (`bet:accept:`, `bet:reject:`, `qotd:vote:`, `confess:react:`) and modal submissions (`confess_modal`) are routed in `interactionCreate.ts`.
  - `/help` command output includes descriptions of `/confess`, `/bet`, and `/qotd`.
- [ ] **Step 2: Run test to verify failure.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/cluster2Router.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Implement registration, routing, startup cron initialization, and web documentation.**
  Add commands to `ready.ts`, route modals/buttons in `interactionCreate.ts`, start QOTD cron in `index.ts`, and add documentation cards in `commands.ts`.
- [ ] **Step 4: Run full test suite and monorepo typecheck.**
  Run: `pnpm run typecheck && pnpm run test`
  Expected: PASS across all packages.
- [ ] **Step 5: Commit changes.**
  ```bash
  git add apps/bot/src/commands/index.ts apps/bot/src/events/ready.ts apps/bot/src/events/interactionCreate.ts apps/bot/src/index.ts apps/web/src/content/commands.ts apps/bot/tests/cluster2Router.test.ts
  git commit -m "feat(bot): register cluster 2 commands, wire up interaction router, and update docs"
  ```
