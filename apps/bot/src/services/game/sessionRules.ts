import type { BoardCell, GameAction, GameSessionView, GameState, RpsChoice } from '@sentinel/shared';

const ACTIVE_MS = 30 * 60_000;
const RETENTION_MS = 24 * 60 * 60_000;
const LINES = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8],
  [0, 3, 6], [1, 4, 7], [2, 5, 8],
  [0, 4, 8], [2, 4, 6]
] as const;

export class GameRuleError extends Error {
  constructor(public readonly code: 'expired' | 'forbidden' | 'invalid' | 'conflict', message: string) {
    super(message);
  }
}

function invalid(message: string): never { throw new GameRuleError('invalid', message); }
function forbidden(message: string): never { throw new GameRuleError('forbidden', message); }
function conflict(message: string): never { throw new GameRuleError('conflict', message); }

function finish(state: GameState, winnerId: string | null, reason: 'line' | 'draw' | 'rps', now: Date): GameState {
  return {
    ...state, phase: 'finished', result: { winnerId, reason }, turnId: undefined,
    expiresAt: now, deleteAt: new Date(now.getTime() + RETENTION_MS)
  };
}

export function applyGameRule(session: GameState, actorId: string, action: GameAction, now: Date): GameState {
  if (session.phase === 'finished') conflict('Ván đã kết thúc.');
  if (now.getTime() >= session.expiresAt.getTime()) throw new GameRuleError('expired', 'Ván đã hết hạn.');

  if (action.type === 'join') {
    if (session.phase !== 'waiting') conflict('Ván đã có đủ người.');
    if (actorId === session.creatorId) forbidden('Bạn không thể tự tham gia ván của mình.');
    if (!actorId) forbidden('Cần đăng nhập để tham gia.');
    return {
      ...session, opponentId: actorId, phase: 'active',
      expiresAt: new Date(now.getTime() + ACTIVE_MS),
      deleteAt: new Date(now.getTime() + ACTIVE_MS + RETENTION_MS)
    };
  }

  if (session.phase !== 'active' || !session.opponentId) conflict('Ván chưa sẵn sàng.');
  if (actorId !== session.creatorId && actorId !== session.opponentId) forbidden('Bạn không thuộc ván này.');

  if (action.type === 'place') {
    if (session.kind !== 'tictactoe') invalid('Không thể đánh ô trong game này.');
    if (!Number.isInteger(action.cell) || action.cell < 0 || action.cell > 8) invalid('Ô không hợp lệ.');
    if (session.turnId !== actorId) forbidden('Chưa đến lượt bạn.');
    const board: BoardCell[] = [...(session.board ?? Array<BoardCell>(9).fill(null))];
    if (board[action.cell] !== null) conflict('Ô này đã được đánh.');
    const mark = actorId === session.creatorId ? 'X' : 'O';
    board[action.cell] = mark;
    const moved: GameState = { ...session, board };
    if (LINES.some(([a, b, c]) => board[a] === mark && board[b] === mark && board[c] === mark)) {
      return finish(moved, actorId, 'line', now);
    }
    if (board.every((cell) => cell !== null)) return finish(moved, null, 'draw', now);
    return {
      ...moved, turnId: actorId === session.creatorId ? session.opponentId : session.creatorId,
      expiresAt: new Date(now.getTime() + ACTIVE_MS),
      deleteAt: new Date(now.getTime() + ACTIVE_MS + RETENTION_MS)
    };
  }

  if (action.type === 'choose') {
    if (session.kind !== 'rps') invalid('Không thể chọn búa/kéo/bao trong game này.');
    if (!['rock', 'paper', 'scissors'].includes(action.choice)) invalid('Lựa chọn không hợp lệ.');
    if (session.choices?.[actorId]) conflict('Bạn đã chọn rồi.');
    const choices: Record<string, RpsChoice> = { ...session.choices, [actorId]: action.choice };
    const chosen: GameState = { ...session, choices };
    if (choices[session.creatorId] && choices[session.opponentId]) {
      const first = choices[session.creatorId];
      const second = choices[session.opponentId];
      const firstWins = (first === 'rock' && second === 'scissors') ||
        (first === 'scissors' && second === 'paper') ||
        (first === 'paper' && second === 'rock');
      return finish(chosen, first === second ? null : firstWins ? session.creatorId : session.opponentId, 'rps', now);
    }
    return {
      ...chosen, expiresAt: new Date(now.getTime() + ACTIVE_MS),
      deleteAt: new Date(now.getTime() + ACTIVE_MS + RETENTION_MS)
    };
  }

  return invalid('Hành động không hợp lệ.');
}

export function projectGame(session: GameState, viewerId?: string, now = new Date()): GameSessionView {
  const phase = session.phase !== 'finished' && now.getTime() >= session.expiresAt.getTime()
    ? 'expired' : session.phase;
  const view: GameSessionView = {
    sessionId: session.sessionId, guildId: session.guildId, kind: session.kind,
    creatorId: session.creatorId, opponentId: session.opponentId, phase,
    expiresAt: session.expiresAt.toISOString(), result: session.result
  };
  if (session.channelId && session.messageId) {
    view.discordMessageUrl = `https://discord.com/channels/${session.guildId}/${session.channelId}/${session.messageId}`;
  }
  if (session.kind === 'tictactoe') {
    view.board = [...(session.board ?? [])];
    view.turnId = session.turnId;
  } else {
    const choices = session.choices ?? {};
    view.rps = {
      creatorChosen: !!choices[session.creatorId],
      opponentChosen: !!(session.opponentId && choices[session.opponentId])
    };
    if (viewerId && choices[viewerId] && (viewerId === session.creatorId || viewerId === session.opponentId)) {
      view.rps.ownChoice = choices[viewerId];
    }
    if (phase === 'finished' && session.opponentId && choices[session.creatorId] && choices[session.opponentId]) {
      view.rps.choices = { creator: choices[session.creatorId], opponent: choices[session.opponentId] };
    }
  }
  return view;
}
