import { nanoid } from 'nanoid';
import type { GameAction, GameKind, GameSessionView, GameState } from '@sentinel/shared';
import { GameSessionModel } from '../../models/GameSession';
import { applyGameRule, GameRuleError, projectGame } from './sessionRules';

const WAIT_MS = 15 * 60_000;
const RETENTION_MS = 24 * 60 * 60_000;
const ID_PATTERN = /^[A-Za-z0-9_-]{21}$/;

export class GameSessionError extends Error {
  constructor(public readonly code: 'not_found' | 'conflict' | 'forbidden', message: string) { super(message); }
}

function validId(sessionId: string): void {
  if (!ID_PATTERN.test(sessionId)) throw new GameSessionError('not_found', 'Ván không tồn tại.');
}

async function readState(sessionId: string): Promise<GameState> {
  validId(sessionId);
  const state = await GameSessionModel.findOne({ sessionId }).lean();
  if (!state) throw new GameSessionError('not_found', 'Ván không tồn tại.');
  return state as unknown as GameState;
}

export async function createGameSession(
  input: { guildId: string; creatorId: string; kind: GameKind; channelId?: string },
  now = new Date()
): Promise<GameSessionView> {
  if (!/^\d{5,25}$/.test(input.guildId) || !/^\d{5,25}$/.test(input.creatorId) ||
    !['tictactoe', 'rps'].includes(input.kind)) throw new GameRuleError('invalid', 'Thông tin tạo ván không hợp lệ.');
  const activeKey = `${input.guildId}:${input.creatorId}`;
  await GameSessionModel.updateMany({ activeKey, expiresAt: { $lte: now } }, { $unset: { activeKey: '' } });
  const expiresAt = new Date(now.getTime() + WAIT_MS);
  const state: GameState & { activeKey: string } = {
    sessionId: nanoid(21), guildId: input.guildId, creatorId: input.creatorId,
    kind: input.kind, opponentId: null, phase: 'waiting', version: 0,
    expiresAt, deleteAt: new Date(expiresAt.getTime() + RETENTION_MS), activeKey,
    ...(input.channelId ? { channelId: input.channelId } : {}),
    ...(input.kind === 'tictactoe' ? { board: Array(9).fill(null), turnId: input.creatorId } : { choices: {} })
  };
  try {
    const created = await GameSessionModel.create(state);
    return projectGame(created, input.creatorId, now);
  } catch (error) {
    if ((error as { code?: number }).code === 11000) {
      throw new GameSessionError('conflict', 'Bạn đã có một ván chưa kết thúc trong server này.');
    }
    throw error;
  }
}

export async function getGameSession(sessionId: string, viewerId?: string, now = new Date()): Promise<GameSessionView> {
  const state = await readState(sessionId);
  return projectGame(state, viewerId, now);
}

export async function actOnGameSession(
  sessionId: string, actorId: string, action: GameAction, now = new Date()
): Promise<GameSessionView> {
  const state = await readState(sessionId);
  const next = applyGameRule(state, actorId, action, now);
  const update = {
    $set: {
      opponentId: next.opponentId, phase: next.phase, expiresAt: next.expiresAt, deleteAt: next.deleteAt,
      board: next.board, turnId: next.turnId, choices: next.choices, result: next.result
    },
    $inc: { version: 1 },
    ...(next.phase === 'finished' ? { $unset: { activeKey: '' } } : {})
  };
  const written = await GameSessionModel.findOneAndUpdate(
    { sessionId, version: state.version, expiresAt: { $gt: now } }, update,
    { new: true, lean: true }
  );
  if (!written) throw new GameSessionError('conflict', 'Ván vừa thay đổi. Hãy tải lại trạng thái.');
  return projectGame(written as unknown as GameState, actorId, now);
}

export async function attachGameMessage(
  sessionId: string, actorId: string, guildId: string, channelId: string, messageId: string, now = new Date()
): Promise<GameSessionView> {
  const state = await readState(sessionId);
  if (state.guildId !== guildId || (actorId !== state.creatorId && actorId !== state.opponentId)) {
    throw new GameSessionError('forbidden', 'Bạn không được mở ván này tại server hiện tại.');
  }
  if (state.phase === 'finished' || now.getTime() >= state.expiresAt.getTime()) {
    throw new GameRuleError('expired', 'Ván đã kết thúc hoặc hết hạn.');
  }
  if (state.channelId && state.messageId) return projectGame(state, actorId, now);
  const written = await GameSessionModel.findOneAndUpdate(
    { sessionId, version: state.version, messageId: { $exists: false } },
    { $set: { channelId, messageId }, $inc: { version: 1 } },
    { new: true, lean: true }
  );
  if (!written) throw new GameSessionError('conflict', 'Ván đã được mở trong Discord.');
  return projectGame(written as unknown as GameState, actorId, now);
}
