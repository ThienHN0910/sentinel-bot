import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameState } from '@sentinel/shared';
import * as models from '../src/models';
import * as game from '../src/services/game';

const GameSessionModel = (models as any).GameSessionModel;
const { createGameSession, getGameSession, actOnGameSession, attachGameMessage } = game as any;

const now = new Date('2026-09-29T01:00:00Z');
const id = 'abcdefghijklmnopqrstu';
function active(): GameState {
  return {
    sessionId: id, guildId: 'guild-1', kind: 'tictactoe', creatorId: 'alice', opponentId: 'bob',
    phase: 'active', expiresAt: new Date(now.getTime() + 30 * 60_000),
    deleteAt: new Date(now.getTime() + 30 * 60_000 + 86_400_000),
    version: 0, board: Array(9).fill(null), turnId: 'alice'
  };
}

describe('durable game sessions', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('creates a 21-character waiting session with a 15-minute deadline and active reservation', async () => {
    vi.spyOn(GameSessionModel, 'updateMany').mockResolvedValue({ modifiedCount: 0 } as never);
    const create = vi.spyOn(GameSessionModel, 'create').mockImplementation(async (data) => data as never);
    const result = await createGameSession({
      guildId: '123456789012345678', creatorId: '234567890123456789', kind: 'rps'
    }, now);
    expect(result.phase).toBe('waiting');
    expect(result.sessionId).toMatch(/^[A-Za-z0-9_-]{21}$/);
    const stored = create.mock.calls[0][0] as unknown as GameState & { activeKey: string };
    expect(stored.activeKey).toBe('123456789012345678:234567890123456789');
    expect(stored.expiresAt.getTime()).toBe(now.getTime() + 15 * 60_000);
    expect(stored.deleteAt.getTime()).toBe(now.getTime() + 15 * 60_000 + 86_400_000);
  });

  it('declares unique session/reservation indexes and terminal TTL', () => {
    const indexes = GameSessionModel.schema.indexes();
    expect(indexes.some(([fields, options]) => fields.sessionId === 1 && options.unique)).toBe(true);
    expect(indexes.some(([fields, options]) => fields.activeKey === 1 && options.unique)).toBe(true);
    expect(indexes.some(([fields, options]) => fields.deleteAt === 1 && options.expireAfterSeconds === 0)).toBe(true);
  });

  it('commits one move when two writes race on the same version', async () => {
    let current = active();
    vi.spyOn(GameSessionModel, 'findOne').mockImplementation(() => ({ lean: async () => ({ ...current, board: [...current.board!] }) }) as never);
    vi.spyOn(GameSessionModel, 'findOneAndUpdate').mockImplementation(async (filter: any, update: any) => {
      await Promise.resolve();
      if (filter.version !== current.version) return null;
      current = { ...current, ...update.$set, version: current.version + 1 };
      return current as never;
    });
    const results = await Promise.allSettled([
      actOnGameSession(id, 'alice', { type: 'place', cell: 0 }, now),
      actOnGameSession(id, 'alice', { type: 'place', cell: 1 }, now)
    ]);
    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
    expect((await getGameSession(id, 'alice', now)).board?.filter(Boolean)).toHaveLength(1);
  });

  it('rejects an expired session without writing a move', async () => {
    const expired = active();
    expired.expiresAt = now;
    vi.spyOn(GameSessionModel, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(expired) } as never);
    const update = vi.spyOn(GameSessionModel, 'findOneAndUpdate');
    await expect(actOnGameSession(id, 'alice', { type: 'place', cell: 0 }, now)).rejects.toMatchObject({ code: 'expired' });
    expect(update).not.toHaveBeenCalled();
  });

  it('attaches one Discord message only for a player in the same guild', async () => {
    const session = active();
    vi.spyOn(GameSessionModel, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(session) } as never);
    const update = vi.spyOn(GameSessionModel, 'findOneAndUpdate').mockResolvedValue({
      ...session, channelId: 'channel-1', messageId: 'message-1'
    } as never);
    await expect(attachGameMessage(id, 'stranger', 'guild-1', 'channel-1', 'message-1', now))
      .rejects.toMatchObject({ code: 'forbidden' });
    const view = await attachGameMessage(id, 'alice', 'guild-1', 'channel-1', 'message-1', now);
    expect(view.discordMessageUrl).toContain('/guild-1/channel-1/message-1');
    expect(update).toHaveBeenCalledTimes(1);
  });
});
