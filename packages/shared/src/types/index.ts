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
  repCount?: number;
  repGivenToday?: number;
  lastRepResetAt?: Date;
  lastGachaAt?: Date;
  gachaPity?: number;
  mentionedUsers: Record<string, number>;
  updatedAt: Date;
}

export type GachaRarity = 'COMMON' | 'UNCOMMON' | 'RARE' | 'EPIC' | 'LEGENDARY';

export interface GachaResult {
  rarity: GachaRarity;
  rewardCoins: number;
  rewardXp: number;
  isFree: boolean;
  cost: number;
  newBalance: number;
  pity: number;
  isPityGuaranteed?: boolean;
}

export interface RepResult {
  success: boolean;
  giverRemaining: number;
  receiverRepCount: number;
  error?: string;
}

export type RankingMetric = 'chat' | 'voice' | 'level';

export interface RankingRow {
  rank: number;
  userId: string;
  username: string;
  avatar: string;
  score: number;
  level?: number;
}

export interface RankingPage {
  rows: RankingRow[];
  nextCursor: string | null;
  generatedAt: string;
}

export interface IGuildConfig {
  guildId: string;
  name: string;
  welcomeVoiceTts: boolean;
  welcomeMessage: string;
  reportChannelId?: string;
  confessionChannelId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IConfession {
  guildId: string;
  confessionNumber: number;
  content: string;
  messageId: string;
  createdAt: Date;
}

export interface GuildSettingsInput {
  welcomeVoiceTts?: boolean;
  welcomeMessage?: string;
  reportChannelId?: string | null;
}

export interface GuildSettingsResponse {
  welcomeVoiceTts: boolean;
  welcomeMessage: string;
  reportChannelId: string | null;
  channels: { id: string; name: string }[];
}

export interface IWordStat {
  guildId: string;
  word: string;
  count: number;
  lastSeenAt: Date;
}

export interface IReminder {
  id?: string;
  publicId: string;
  userId: string;
  guildId: string;
  message: string;
  remindAt: Date;
  status: 'pending' | 'sending' | 'completed' | 'failed' | 'cancelled';
  slot: number;
  attempts: number;
  claimedAt?: Date;
  deleteAt?: Date;
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

export type WheelEventPayload = WheelSocketEvent;
export * from './game';

export type BetKind = 'p2p' | 'pool';
export type BetStatus = 'open' | 'active' | 'locked' | 'resolved' | 'cancelled';

export interface Wager {
  userId: string;
  username: string;
  option: string;
  amount: number;
  createdAt: Date;
}

export interface IBet {
  betId: string;
  guildId: string;
  kind: BetKind;
  creatorId: string;
  creatorUsername: string;
  opponentId?: string;
  opponentUsername?: string;
  title: string;
  options: string[];
  wagers: Wager[];
  status: BetStatus;
  winnerOption?: string;
  winnerUserId?: string;
  totalPool: number;
  expiresAt: Date;
  resolvedAt?: Date;
  createdAt: Date;
}

