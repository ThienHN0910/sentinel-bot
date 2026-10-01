# Fun Pack Cluster 3 Implementation Plan: Progression & Identity (/pet, /badge, /profile)

## Overview
Implement Cluster 3 ("Progression & Identity") of the Sentinel Bot Fun Pack:
1. **Virtual Pet System (`/pet`)**: Low-maintenance, zero-death virtual pet (Cat, Dog, Dragon, Fox). Feeds, plays, tracks hunger & happiness, and dynamically computes mood (`Hạnh phúc ✨`, `Đói bụng 🥪`, `Buồn bã 😿`). Supports interactive Discord buttons.
2. **Achievement Badge System (`/badge`)**: Auto-unlock milestones across chatter counts, voice hours, streak records, coin balance, reputation, and gacha legendary. Equips badge title to user identity.
3. **Unified Profile Card (`/profile`)**: Comprehensive Discord embed card showcasing user level, visual XP bar, wealth, rep, activity stats, virtual pet status, equipped badge, and interactive button drawer for badge showcase.
4. **Router & Documentation Integration**: Registration in `ready.ts`, interaction router in `interactionCreate.ts`, exports in `commands/index.ts`, web documentation in `apps/web/src/content/commands.ts`, and full test verification.

---

## Proposed Changes

### 1. Types & Shared Definitions (`packages/shared`)
- Export `PetType` (`'cat' | 'dog' | 'dragon' | 'fox'`), `PetMood` (`'happy' | 'hungry' | 'sad'`), and `IPet`.
- Export `IBadge` contract and predefined badge constants.
- Extend `IUserStat` with `unlockedBadges: string[]` and `equippedBadge?: string | null`.

### 2. Models Layer (`apps/bot/src/models`)
- Create `PetModel` (`apps/bot/src/models/Pet.ts`) with unique compound index `{ guildId: 1, userId: 1 }`.
- Extend `UserStatModel` (`apps/bot/src/models/UserStat.ts`) with `unlockedBadges: { type: [String], default: [] }` and `equippedBadge: { type: String, default: null }`.

### 3. Services Layer (`apps/bot/src/services`)
- Create `PetService` (`apps/bot/src/services/pet/PetService.ts`):
  - `adoptPet(guildId, userId, type, name)`: Validates type, limits 1 pet per user per guild, initializes hunger=80, happiness=80.
  - `getPetStatus(guildId, userId)`: Calculates real-time decay and mood:
    - Within 24h since `lastFedAt`: `Hạnh phúc ✨`
    - 24h - 48h: `Đói bụng 🥪`
    - > 48h: `Buồn bã 😿`
    - Zero death guarantee: Pet never dies or runs away.
  - `feedPet(guildId, userId)`: Atomically deducts 10 DNE Coins (or free if hungry), restores hunger to 100, boosts happiness, updates `lastFedAt`.
  - `playWithPet(guildId, userId)`: Enforces 30m cooldown, restores happiness +25 (max 100), updates `lastPlayedAt`.
- Create `BadgeService` (`apps/bot/src/services/badge/BadgeService.ts`):
  - Predefined badge catalog (10 badges: `chatter_100`, `chatter_1000`, `chatter_5000`, `voice_10h`, `voice_night`, `voice_50h`, `streak_7`, `coins_10k`, `rep_20`, `gacha_legendary`).
  - `evaluateBadges(guildId, userId)`: Checks `UserStat` numbers and atomically grants eligible unearned badges via `$addToSet: { unlockedBadges: badgeId }`.
  - `equipBadge(guildId, userId, badgeId)`: Verifies user unlocked badge and equips it.
  - `unequipBadge(guildId, userId)`: Removes equipped badge.

### 4. Commands Layer (`apps/bot/src/commands`)
- `/pet` (`apps/bot/src/commands/pet.ts`):
  - Subcommands: `adopt`, `status`, `feed`, `play`.
  - Interactive button handler `handlePetButton` for `pet:feed` and `pet:play`.
- `/badge` (`apps/bot/src/commands/badge.ts`):
  - Subcommands: `list`, `equip id:<id>`, `unequip`.
- `/profile` (`apps/bot/src/commands/profile.ts`):
  - Evaluates badges, gathers `UserStat` + `PetModel`, renders unified embed with XP progress bar, stats, pet badge, and button `profile:badges:<userId>`.

---

## Tasks

### Task 1: Virtual Pet Engine (`PetModel`, `PetService`, `/pet` & Buttons)
- [ ] Define `IPet`, `PetType`, and `PetMood` in `packages/shared/src/types/index.ts`.
- [ ] Create `apps/bot/src/models/Pet.ts`.
- [ ] Create `apps/bot/src/services/pet/PetService.ts`.
- [ ] Implement `/pet` slash command and button handler in `apps/bot/src/commands/pet.ts`.
- [ ] Write unit & integration tests in `apps/bot/tests/petService.test.ts`.

### Task 2: Badge Achievement System (`BadgeService`, Auto-Unlock & `/badge`)
- [ ] Define badge list and `IBadge` contract in `packages/shared`.
- [ ] Add `unlockedBadges` and `equippedBadge` to `UserStatModel`.
- [ ] Create `BadgeService` in `apps/bot/src/services/badge/BadgeService.ts`.
- [ ] Implement `/badge` slash command in `apps/bot/src/commands/badge.ts`.
- [ ] Write tests in `apps/bot/tests/badgeService.test.ts`.

### Task 3: Unified Profile Card (`/profile` & Badge Drawer)
- [ ] Create `apps/bot/src/commands/profile.ts` aggregating stats, badges, and pet.
- [ ] Add interactive button handler for `profile:badges:<userId>`.
- [ ] Write tests in `apps/bot/tests/profileCommand.test.ts`.

### Task 4: Router Integration, Web Documentation, and Full Verification
- [ ] Re-export all handlers in `apps/bot/src/commands/index.ts`.
- [ ] Register slash commands `/pet`, `/badge`, `/profile` in `apps/bot/src/events/ready.ts`.
- [ ] Route commands and buttons in `apps/bot/src/events/interactionCreate.ts`.
- [ ] Add command documentation cards in `apps/web/src/content/commands.ts`.
- [ ] Write integration test in `apps/bot/tests/cluster3Router.test.ts`.
- [ ] Run full monorepo typecheck, build, and tests.
