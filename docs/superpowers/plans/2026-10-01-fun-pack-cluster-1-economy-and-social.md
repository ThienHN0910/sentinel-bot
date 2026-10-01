# Fun Pack Cluster 1: Economy & Social (Daily, Rep, Gacha) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `/daily` (streak check-in with visual progress), `/rep` (peer social appreciation with daily cap), and `/gacha` (daily lucky roll with weighted drop table and pity guarantee).

**Architecture:** Keep Discord slash command handlers thin as presentation controllers. Reuse `EconomyService.claimDaily` for streak claiming; introduce `RepService` for reputation quotas and atomic updates; introduce `GachaService` for drop probability and escrow transaction handling. Update `UserStat` schema in both `@sentinel/shared` and `@sentinel/bot`.

**Tech Stack:** TypeScript 5.5, discord.js 14, MongoDB/Mongoose 8.5, Vitest 2.0.

**Spec:** `docs/superpowers/specs/2026-10-01-fun-pack-design.md`

## Global Constraints

- Never hardcode credentials; follow Zero-Leakage Security Hygiene.
- Zero breaking changes to existing economy fields (`dneCoins`, `exp`, `level`, `dailyStreak`, `lastDailyAt`).
- All coin mutations must use atomic updates or MongoDB transactions to prevent duplicate spend.
- `/daily` enforces 20h cooldown, 7-day cap, 48h reset.
- `/rep` enforces max 3 rep given per user per day (reset at 00:00 UTC+7); forbids self-rep.
- `/gacha` grants 1 free roll per 24 hours; subsequent rolls cost 200 DNE Coins; pity activates at 50 consecutive non-Epic rolls.

---

## File map

- `packages/shared/src/types/index.ts`: Add `repCount`, `repGivenToday`, `lastRepResetAt`, `lastGachaAt`, `gachaPity` to `IUserStat`. Add Gacha and Rep type definitions.
- `apps/bot/src/models/UserStat.ts`: Add new schema fields with sensible defaults.
- `apps/bot/src/services/economy/EconomyService.ts`: Add `getDailyStatus(guildId, userId)` helper to calculate remaining cooldown.
- `apps/bot/src/commands/daily.ts`: Create `/daily` slash command with visual progress bar embed and cooldown feedback.
- `apps/bot/src/services/economy/RepService.ts`: Reputation quota validation, daily reset logic, and atomic increment.
- `apps/bot/src/commands/rep.ts`: Create `/rep @user [reason]` slash command.
- `apps/bot/src/services/economy/GachaService.ts`: Drop tables, RNG, pity counter, and coin deduction transactions.
- `apps/bot/src/commands/gacha.ts`: Create `/gacha spin` slash command with embed presentation.
- `apps/bot/src/commands/index.ts`, `apps/bot/src/events/ready.ts`, `apps/bot/src/events/interactionCreate.ts`: Register and route new commands.
- `apps/bot/src/commands/help.ts`, `apps/web/src/content/commands.ts`: Update command documentation.
- `apps/bot/tests/dailyCommand.test.ts`, `apps/bot/tests/repService.test.ts`, `apps/bot/tests/gachaService.test.ts`: Behavior and unit test suites.

---

### Task 1: Expose `/daily` command with streak progress & cooldown

**Files:**
- Modify: `apps/bot/src/services/economy/EconomyService.ts`
- Create: `apps/bot/src/commands/daily.ts`
- Test: `apps/bot/tests/dailyCommand.test.ts`

**Interfaces:**
- Consumes: `EconomyService.claimDaily(guildId: string, userId: string, username?: string)`
- Produces: `EconomyService.getDailyStatus(guildId: string, userId: string, now?: Date): Promise<{ canClaim: boolean; hoursRemaining: number; currentStreak: number }>`
- Produces: `handleDailyCommand(interaction: ChatInputCommandInteraction): Promise<void>`

- [ ] **Step 1: Write failing tests for `getDailyStatus` and `/daily` response logic.** Assert that when `lastDailyAt` was 5 hours ago, `canClaim` is false and `hoursRemaining` is ~15; when never claimed or >20 hours ago, `canClaim` is true. Assert embed formatting contains streak flame and progress bar.
- [ ] **Step 2: Run test to verify failure.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/dailyCommand.test.ts`
  Expected: FAIL (file or method not found).
- [ ] **Step 3: Implement `getDailyStatus` in `EconomyService.ts` and `handleDailyCommand` in `apps/bot/src/commands/daily.ts`.**
  Build visual progress bar: e.g. `█████░░ 5/7 ngày`. If on cooldown, reply with ephemeral or public embed explaining remaining time. If claimed successfully, display streak count, bonus coins, and new total balance.
- [ ] **Step 4: Run test to verify it passes.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/dailyCommand.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit changes.**
  ```bash
  git add apps/bot/src/services/economy/EconomyService.ts apps/bot/src/commands/daily.ts apps/bot/tests/dailyCommand.test.ts
  git commit -m "feat(bot): add /daily slash command with streak visualization"
  ```

---

### Task 2: Reputation System (`/rep @user [reason]`)

**Files:**
- Modify: `packages/shared/src/types/index.ts`
- Modify: `apps/bot/src/models/UserStat.ts`
- Create: `apps/bot/src/services/economy/RepService.ts`
- Create: `apps/bot/src/commands/rep.ts`
- Test: `apps/bot/tests/repService.test.ts`

**Interfaces:**
- Produces in shared types:
  ```ts
  export interface RepResult {
    success: boolean;
    giverRemaining: number;
    receiverRepCount: number;
    error?: string;
  }
  ```
- Produces: `RepService.giveRep(params: { guildId: string; giverId: string; giverUsername: string; receiverId: string; receiverUsername: string; reason?: string; now?: Date }): Promise<RepResult>`
- Produces: `handleRepCommand(interaction: ChatInputCommandInteraction): Promise<void>`

- [ ] **Step 1: Write failing tests in `apps/bot/tests/repService.test.ts`.**
  Assert:
  - Giving rep to oneself throws/returns error: "Không thể tự +rep cho chính mình".
  - Giving rep increments receiver's `repCount` by 1 and decrements giver's remaining daily quota from 3.
  - Attempting a 4th rep on the same day returns error: "Bạn đã dùng hết 3 lượt +rep hôm nay".
  - Quota resets when `now` passes 00:00 UTC+7 of the next day.
- [ ] **Step 2: Run test to verify failure.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/repService.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Update `IUserStat` & `UserStatModel` schema; implement `RepService.ts` and `rep.ts`.**
  Add `repCount: { type: Number, default: 0 }`, `repGivenToday: { type: Number, default: 0 }`, `lastRepResetAt: { type: Date }`.
  Implement `giveRep` with atomic operations and daily reset check.
  Implement `handleRepCommand` rendering embed with avatar, congratulations message, and remaining reps.
- [ ] **Step 4: Run test to verify it passes.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/repService.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit changes.**
  ```bash
  git add packages/shared/src/types/index.ts apps/bot/src/models/UserStat.ts apps/bot/src/services/economy/RepService.ts apps/bot/src/commands/rep.ts apps/bot/tests/repService.test.ts
  git commit -m "feat(bot): implement reputation system and /rep command"
  ```

---

### Task 3: Gacha System (`/gacha spin`)

**Files:**
- Modify: `packages/shared/src/types/index.ts`
- Modify: `apps/bot/src/models/UserStat.ts`
- Create: `apps/bot/src/services/economy/GachaService.ts`
- Create: `apps/bot/src/commands/gacha.ts`
- Test: `apps/bot/tests/gachaService.test.ts`

**Interfaces:**
- Produces in shared types:
  ```ts
  export type GachaRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';
  export interface GachaResult {
    rarity: GachaRarity;
    rewardCoins: number;
    rewardXp: number;
    isFree: boolean;
    cost: number;
    newBalance: number;
    pity: number;
  }
  ```
- Produces: `GachaService.spin(params: { guildId: string; userId: string; username: string; now?: Date }): Promise<GachaResult>`
- Produces: `handleGachaCommand(interaction: ChatInputCommandInteraction): Promise<void>`

- [ ] **Step 1: Write failing tests in `apps/bot/tests/gachaService.test.ts`.**
  Assert:
  - First roll of the day is free (`isFree: true`, `cost: 0`), updates `lastGachaAt`.
  - Second roll within 24 hours costs 200 DNE Coins; if user has insufficient balance (< 200 DNE), rejects with clear error message.
  - Rolling Epic or Legendary resets `gachaPity` to 0.
  - Non-Epic rolls increment `gachaPity` by 1.
  - When `gachaPity >= 50`, roll is guaranteed to be at least Epic.
- [ ] **Step 2: Run test to verify failure.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/gachaService.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Update `UserStatModel` schema; implement `GachaService.ts` and `gacha.ts`.**
  Add `lastGachaAt: { type: Date }` and `gachaPity: { type: Number, default: 0 }`.
  Implement `GachaService.spin` with weighted selection algorithm and coin deduction.
  Implement `handleGachaCommand` returning styled Discord embed with rarity colors (Common: Gray, Uncommon: Green, Rare: Blue, Epic: Purple, Legendary: Gold).
- [ ] **Step 4: Run test to verify it passes.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/gachaService.test.ts`
  Expected: PASS.
- [ ] **Step 5: Commit changes.**
  ```bash
  git add packages/shared/src/types/index.ts apps/bot/src/models/UserStat.ts apps/bot/src/services/economy/GachaService.ts apps/bot/src/commands/gacha.ts apps/bot/tests/gachaService.test.ts
  git commit -m "feat(bot): implement /gacha command with pity mechanics"
  ```

---

### Task 4: Command Registration, Router Integration, and Help Synchronization

**Files:**
- Modify: `apps/bot/src/commands/index.ts`
- Modify: `apps/bot/src/commands/help.ts`
- Modify: `apps/bot/src/events/ready.ts`
- Modify: `apps/bot/src/events/interactionCreate.ts`
- Modify: `apps/web/src/content/commands.ts`
- Test: `apps/bot/tests/commandRouter.test.ts`

**Interfaces:**
- Registers `/daily`, `/rep`, `/gacha` in the Discord Slash Command definitions in `ready.ts`.
- Routes commands to `handleDailyCommand`, `handleRepCommand`, `handleGachaCommand` in `interactionCreate.ts`.

- [ ] **Step 1: Write test verifying all 3 commands are exported in `commands/index.ts` and present in `/help` descriptions.**
- [ ] **Step 2: Run test to verify failure.**
  Run: `pnpm --filter @sentinel/bot exec vitest run tests/commandRouter.test.ts`
  Expected: FAIL.
- [ ] **Step 3: Register commands in `events/ready.ts`, route them in `events/interactionCreate.ts`, export in `commands/index.ts`, update `help.ts` and `apps/web/src/content/commands.ts`.**
- [ ] **Step 4: Run monorepo typecheck and all tests.**
  Run: `pnpm run typecheck && pnpm run test`
  Expected: PASS across all packages.
- [ ] **Step 5: Commit changes.**
  ```bash
  git add apps/bot/src/commands/index.ts apps/bot/src/commands/help.ts apps/bot/src/events/ready.ts apps/bot/src/events/interactionCreate.ts apps/web/src/content/commands.ts apps/bot/tests/commandRouter.test.ts
  git commit -m "feat(bot): register /daily, /rep, and /gacha commands in router and help"
  ```
