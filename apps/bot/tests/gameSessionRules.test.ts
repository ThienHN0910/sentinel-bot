import { describe, expect, it } from 'vitest';
import * as game from '../src/services/game';
import type { GameState } from '@sentinel/shared';

const { applyGameRule, projectGame } = game as unknown as {
  applyGameRule: (state: GameState, actor: string, action: unknown, now: Date) => GameState;
  projectGame: (state: GameState, viewer?: string, now?: Date) => any;
};
const now = new Date('2026-09-29T01:00:00Z');

function waiting(kind: 'tictactoe' | 'rps'): GameState {
  return {
    sessionId: 'abcdefghijklmnopqrstu', guildId: 'guild-1', kind,
    creatorId: 'alice', opponentId: null, phase: 'waiting',
    expiresAt: new Date(now.getTime() + 900_000), deleteAt: new Date(now.getTime() + 900_000 + 86_400_000),
    version: 0, board: kind === 'tictactoe' ? Array(9).fill(null) : undefined,
    turnId: kind === 'tictactoe' ? 'alice' : undefined,
    choices: kind === 'rps' ? {} : undefined
  };
}

describe('shared game rules', () => {
  it('lets a different guild member join without mutating the original state', () => {
    const original = waiting('tictactoe');
    const joined = applyGameRule(original, 'bob', { type: 'join' }, now);
    expect(original.opponentId).toBeNull();
    expect(joined).toMatchObject({ opponentId: 'bob', phase: 'active', turnId: 'alice' });
    expect(joined.expiresAt.getTime()).toBe(now.getTime() + 30 * 60_000);
    expect(() => applyGameRule(original, 'alice', { type: 'join' }, now)).toThrow();
  });

  it('rejects an occupied square and a move by the wrong player', () => {
    const active = applyGameRule(waiting('tictactoe'), 'bob', { type: 'join' }, now);
    expect(() => applyGameRule(active, 'bob', { type: 'place', cell: 0 }, now)).toThrow();
    const moved = applyGameRule(active, 'alice', { type: 'place', cell: 0 }, now);
    expect(moved.board?.[0]).toBe('X');
    expect(() => applyGameRule(moved, 'bob', { type: 'place', cell: 0 }, now)).toThrow();
    expect(() => applyGameRule(moved, 'bob', { type: 'place', cell: 9 }, now)).toThrow();
  });

  it.each([[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]])
  ('recognizes winning line %i-%i-%i', (a, b, c) => {
    const active = applyGameRule(waiting('tictactoe'), 'bob', { type: 'join' }, now);
    const poised = { ...active, board: Array(9).fill(null) };
    poised.board![a] = 'X'; poised.board![b] = 'X';
    const finished = applyGameRule(poised, 'alice', { type: 'place', cell: c }, now);
    expect(finished.result).toMatchObject({ winnerId: 'alice', reason: 'line' });
    expect(finished.phase).toBe('finished');
  });

  it('recognizes a full-board draw', () => {
    const active = applyGameRule(waiting('tictactoe'), 'bob', { type: 'join' }, now);
    const poised: GameState = { ...active, board: ['X', 'O', 'X', 'X', 'O', 'O', 'O', 'X', null], turnId: 'alice' };
    const finished = applyGameRule(poised, 'alice', { type: 'place', cell: 8 }, now);
    expect(finished.result).toEqual({ winnerId: null, reason: 'draw' });
  });

  it('keeps an unpaired RPS choice private until both players choose', () => {
    const active = applyGameRule(waiting('rps'), 'bob', { type: 'join' }, now);
    const chosen = applyGameRule(active, 'alice', { type: 'choose', choice: 'rock' }, now);
    expect(projectGame(chosen, 'alice', now).rps.ownChoice).toBe('rock');
    expect(projectGame(chosen, 'bob', now).rps.ownChoice).toBeUndefined();
    expect(projectGame(chosen, undefined, now).rps.ownChoice).toBeUndefined();
    expect(projectGame(chosen, 'bob', now).rps.choices).toBeUndefined();
    expect(() => applyGameRule(chosen, 'alice', { type: 'choose', choice: 'paper' }, now)).toThrow();
  });

  it.each([
    ['rock', 'scissors', 'alice'], ['scissors', 'paper', 'alice'], ['paper', 'rock', 'alice'],
    ['rock', 'paper', 'bob'], ['rock', 'rock', null]
  ] as const)('resolves %s versus %s', (first, second, winnerId) => {
    const active = applyGameRule(waiting('rps'), 'bob', { type: 'join' }, now);
    const firstMove = applyGameRule(active, 'alice', { type: 'choose', choice: first }, now);
    const finished = applyGameRule(firstMove, 'bob', { type: 'choose', choice: second }, now);
    expect(finished.result?.winnerId).toBe(winnerId);
    expect(finished.phase).toBe('finished');
    expect(projectGame(finished, undefined, now).rps.choices).toEqual({ creator: first, opponent: second });
  });

  it('rejects a move after session expiry', () => {
    const active = applyGameRule(waiting('tictactoe'), 'bob', { type: 'join' }, now);
    expect(() => applyGameRule(active, 'alice', { type: 'place', cell: 0 },
      new Date(now.getTime() + 30 * 60_000))).toThrow();
  });
});
