import { beforeEach, describe, expect, it, vi } from 'vitest';
import { UserStatModel } from '../src/models/UserStat';
import { VoiceSessionModel } from '../src/models/VoiceSession';
import { handleStatsCommand } from '../src/commands/stats';
import { handleLeaderboardCommand } from '../src/commands/leaderboard';
import { handleHelpCommand } from '../src/commands/help';

function interaction(guildId: string | null = 'g1') {
  return {
    guildId,
    user: { id: 'u1', username: 'Alice' },
    guild: { voiceStates: { cache: new Map([['u1', {}]]) } },
    options: { getString: vi.fn().mockReturnValue('chat') },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    deleteReply: vi.fn().mockResolvedValue(undefined),
    followUp: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined)
  } as any;
}

describe('statistics commands', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('privately shows zero stats when a member has no record', async () => {
    vi.spyOn(UserStatModel, 'findOne').mockReturnValue({ lean: async () => null } as any);
    vi.spyOn(VoiceSessionModel, 'findOne').mockReturnValue({ lean: async () => null } as any);
    const command = interaction();
    await handleStatsCommand(command);
    expect(command.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(command.editReply.mock.calls[0][0]).toContain('0 tin nhắn');
    expect(command.editReply.mock.calls[0][0]).toContain('bắt đầu ghi nhận');
  });

  it('includes an active session as an estimate and defers before reading MongoDB', async () => {
    const order: string[] = [];
    const command = interaction();
    command.deferReply.mockImplementation(async () => { order.push('defer'); });
    vi.spyOn(UserStatModel, 'findOne').mockImplementation(() => {
      order.push('query');
      return { lean: async () => ({ totalMessages: 7, totalVoiceSeconds: 300, exp: 50, dneCoins: 20 }) } as any;
    });
    vi.spyOn(VoiceSessionModel, 'findOne').mockReturnValue({ lean: async () => ({ startedAt: new Date(Date.now() - 600_000) }) } as any);
    await handleStatsCommand(command);
    expect(order).toEqual(['defer', 'query']);
    expect(command.editReply.mock.calls[0][0]).toContain('ước tính');
    expect(command.editReply.mock.calls[0][0]).toContain('DNE Coins: 20');
  });

  it('rejects a DM without querying guild statistics', async () => {
    const query = vi.spyOn(UserStatModel, 'findOne');
    const command = interaction(null);
    await handleStatsCommand(command);
    expect(query).not.toHaveBeenCalled();
    expect(command.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });

  it('gives a short private error after a query failure', async () => {
    vi.spyOn(UserStatModel, 'findOne').mockReturnValue({ lean: async () => { throw new Error('db down'); } } as any);
    vi.spyOn(VoiceSessionModel, 'findOne').mockReturnValue({ lean: async () => null } as any);
    const command = interaction();
    await handleStatsCommand(command);
    expect(command.editReply.mock.calls[0][0]).toContain('không tải được');
  });

  it('returns an error after a slow query without leaving the interaction unanswered', async () => {
    vi.spyOn(UserStatModel, 'findOne').mockReturnValue({ lean: () => new Promise(() => undefined) } as any);
    vi.spyOn(VoiceSessionModel, 'findOne').mockReturnValue({ lean: async () => null } as any);
    const command = interaction();
    await handleStatsCommand(command, 10);
    expect(command.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(command.editReply.mock.calls[0][0]).toContain('không tải được');
  });

  it('limits the chat leaderboard to ten users and omits balances', async () => {
    const limit = vi.fn().mockReturnValue({ lean: async () => [{ userId: 'u1', username: 'Alice', totalMessages: 8, dneCoins: 999 }] });
    const sort = vi.fn().mockReturnValue({ limit });
    vi.spyOn(UserStatModel, 'find').mockReturnValue({ sort } as any);
    const command = interaction();
    await handleLeaderboardCommand(command);
    expect(sort).toHaveBeenCalledWith({ totalMessages: -1 });
    expect(limit).toHaveBeenCalledWith(10);
    expect(command.editReply.mock.calls[0][0]).toContain('Alice');
    expect(command.editReply.mock.calls[0][0]).not.toContain('999');
  });

  it('sorts the voice leaderboard by completed voice time', async () => {
    const limit = vi.fn().mockReturnValue({ lean: async () => [{ userId: 'u1', username: 'Alice', totalVoiceSeconds: 120, dneCoins: 999 }] });
    const sort = vi.fn().mockReturnValue({ limit });
    vi.spyOn(UserStatModel, 'find').mockReturnValue({ sort } as any);
    vi.spyOn(VoiceSessionModel, 'find').mockReturnValue({ lean: async () => [] } as any);
    const command = interaction();
    command.options.getString.mockReturnValue('voice');
    await handleLeaderboardCommand(command);
    expect(sort).toHaveBeenCalledWith({ totalVoiceSeconds: -1 });
    expect(limit).toHaveBeenCalledWith(10);
    expect(command.editReply.mock.calls[0][0]).toContain('120');
  });

  it('rejects a leaderboard request in a DM', async () => {
    const query = vi.spyOn(UserStatModel, 'find');
    const command = interaction(null);
    await handleLeaderboardCommand(command);
    expect(query).not.toHaveBeenCalled();
    expect(command.reply).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });

  it('sends a private error if the leaderboard query fails', async () => {
    vi.spyOn(UserStatModel, 'find').mockReturnValue({ sort: () => ({ limit: () => ({ lean: async () => { throw new Error('db down'); } }) }) } as any);
    const command = interaction();
    await handleLeaderboardCommand(command);
    expect(command.deleteReply).toHaveBeenCalled();
    expect(command.followUp).toHaveBeenCalledWith(expect.objectContaining({ ephemeral: true }));
  });

  it('lists only registered commands in help', async () => {
    const command = interaction();
    await handleHelpCommand(command);
    const message = command.reply.mock.calls[0][0].content;
    expect(message).toContain('/random');
    expect(message).toContain('/game');
    expect(message).toContain('/stats');
    expect(message).not.toContain('/daily');
  });
});
