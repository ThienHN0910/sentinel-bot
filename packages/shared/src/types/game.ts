export type GameKind = 'tictactoe' | 'rps';
export type RpsChoice = 'rock' | 'paper' | 'scissors';
export type BoardCell = 'X' | 'O' | null;
export type GamePhase = 'waiting' | 'active' | 'finished' | 'expired';

export type GameAction =
  | { type: 'join' }
  | { type: 'place'; cell: number }
  | { type: 'choose'; choice: RpsChoice };

export interface GameResult {
  winnerId: string | null;
  reason: 'line' | 'draw' | 'rps';
}

export interface GameState {
  sessionId: string;
  guildId: string;
  kind: GameKind;
  creatorId: string;
  opponentId: string | null;
  phase: 'waiting' | 'active' | 'finished';
  expiresAt: Date;
  deleteAt: Date;
  version: number;
  board?: BoardCell[];
  turnId?: string;
  choices?: Record<string, RpsChoice>;
  result?: GameResult;
  channelId?: string;
  messageId?: string;
}

export interface GameSessionView {
  sessionId: string;
  guildId: string;
  kind: GameKind;
  creatorId: string;
  opponentId: string | null;
  phase: GamePhase;
  expiresAt: string;
  board?: BoardCell[];
  turnId?: string;
  rps?: {
    ownChoice?: RpsChoice;
    creatorChosen: boolean;
    opponentChosen: boolean;
    choices?: { creator: RpsChoice; opponent: RpsChoice };
  };
  result?: GameResult;
  discordMessageUrl?: string;
}
