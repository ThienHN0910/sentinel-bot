import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, User } from 'discord.js';
import { UserStatModel } from '../src/models/UserStat';
import { RepService } from '../src/services/economy/RepService';
import {
  handleRepCommand,
  createRepSuccessEmbed,
  createRepErrorEmbed
} from '../src/commands/rep';

function mockInteraction(options: {
  guildId?: string | null;
  userId?: string;
  username?: string;
  targetUser?: Partial<User> | null;
  reason?: string | null;
} = {}) {
  const {
    guildId = 'guild-1',
    userId = 'giver-1',
    username = 'GiverAlice',
    targetUser = { id: 'receiver-1', username: 'ReceiverBob', displayAvatarURL: () => 'https://example.com/avatar.png' } as User,
    reason = 'Helpful pair programming'
  } = options;

  return {
    guildId,
    user: { id: userId, username },
    options: {
      getUser: vi.fn().mockImplementation((name: string) => {
        if (name === 'user' || name === 'target') return targetUser;
        return null;
      }),
      getString: vi.fn().mockImplementation((name: string) => {
        if (name === 'reason') return reason;
        return null;
      })
    },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined)
  } as unknown as ChatInputCommandInteraction;
}

describe('RepService.isNewDay (UTC+7 / Asia/Ho_Chi_Minh)', () => {
  it('returns true if lastReset is undefined', () => {
    expect(RepService.isNewDay(undefined, new Date())).toBe(true);
  });

  it('returns false if both dates are on the same calendar day in UTC+7', () => {
    // 2026-10-01 02:00 UTC = 2026-10-01 09:00 UTC+7
    const morning = new Date('2026-10-01T02:00:00.000Z');
    // 2026-10-01 14:00 UTC = 2026-10-01 21:00 UTC+7
    const evening = new Date('2026-10-01T14:00:00.000Z');

    expect(RepService.isNewDay(morning, evening)).toBe(false);
  });

  it('returns true when crossing 00:00 UTC+7 (17:00:00 UTC)', () => {
    // 2026-10-01 16:59:50 UTC = 2026-10-01 23:59:50 UTC+7
    const beforeMidnight = new Date('2026-10-01T16:59:50.000Z');
    // 2026-10-01 17:00:10 UTC = 2026-10-02 00:00:10 UTC+7
    const afterMidnight = new Date('2026-10-01T17:00:10.000Z');

    expect(RepService.isNewDay(beforeMidnight, afterMidnight)).toBe(true);
  });
});

describe('RepService.giveRep', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects self-reputation with a descriptive error message without DB mutation', async () => {
    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');

    const result = await RepService.giveRep({
      guildId: 'guild-1',
      giverId: 'user-1',
      giverUsername: 'Alice',
      receiverId: 'user-1',
      receiverUsername: 'Alice'
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Bạn không thể tự +rep cho chính mình');
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('successfully gives first rep of the day, increments receiver repCount and decrements giver quota', async () => {
    const now = new Date('2026-10-01T10:00:00.000Z');

    // Giver has never given rep
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValueOnce(null);

    // Receiver updated to repCount = 5
    vi.spyOn(UserStatModel, 'findOneAndUpdate')
      .mockResolvedValueOnce({} as any) // giver update
      .mockResolvedValueOnce({
        guildId: 'guild-1',
        userId: 'receiver-1',
        repCount: 5
      } as any); // receiver update

    const result = await RepService.giveRep({
      guildId: 'guild-1',
      giverId: 'giver-1',
      giverUsername: 'Alice',
      receiverId: 'receiver-1',
      receiverUsername: 'Bob',
      reason: 'Great help in coding',
      now
    });

    expect(result.success).toBe(true);
    expect(result.giverRemaining).toBe(2);
    expect(result.receiverRepCount).toBe(5);
    expect(result.error).toBeUndefined();

    // Verify giver updated with reset today
    expect(UserStatModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { guildId: 'guild-1', userId: 'giver-1' },
      {
        $set: { repGivenToday: 1, lastRepResetAt: now, updatedAt: now },
        $setOnInsert: { username: 'Alice' }
      },
      { upsert: true }
    );

    // Verify receiver repCount incremented
    expect(UserStatModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      2,
      { guildId: 'guild-1', userId: 'receiver-1' },
      {
        $inc: { repCount: 1 },
        $set: { updatedAt: now },
        $setOnInsert: { username: 'Bob' }
      },
      { upsert: true, new: true }
    );
  });

  it('allows 2nd and 3rd rep within the same day', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');

    // Giver already gave 1 rep today
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'giver-1',
      repGivenToday: 1,
      lastRepResetAt: new Date('2026-10-01T08:00:00.000Z')
    } as any);

    vi.spyOn(UserStatModel, 'findOneAndUpdate')
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({
        guildId: 'guild-1',
        userId: 'receiver-1',
        repCount: 10
      } as any);

    const result = await RepService.giveRep({
      guildId: 'guild-1',
      giverId: 'giver-1',
      receiverId: 'receiver-1',
      now
    });

    expect(result.success).toBe(true);
    expect(result.giverRemaining).toBe(1);
    expect(result.receiverRepCount).toBe(10);

    // Verify giver incremented without re-setting lastRepResetAt
    expect(UserStatModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { guildId: 'guild-1', userId: 'giver-1', repGivenToday: { $lt: 3 } },
      {
        $inc: { repGivenToday: 1 },
        $set: { updatedAt: now },
        $setOnInsert: { username: 'giver-1' }
      },
      { new: true }
    );
  });

  it('rejects concurrent rep attempt when repGivenToday reaches 3 during race condition', async () => {
    const now = new Date('2026-10-01T12:00:00.000Z');

    // Giver read passes with repGivenToday = 2
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'giver-1',
      repGivenToday: 2,
      lastRepResetAt: new Date('2026-10-01T08:00:00.000Z')
    } as any);

    // Atomic update fails because another concurrent call incremented to 3
    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValueOnce(null);

    const result = await RepService.giveRep({
      guildId: 'guild-1',
      giverId: 'giver-1',
      receiverId: 'receiver-1',
      now
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('Bạn đã dùng hết 3 lượt +rep hôm nay! Hãy quay lại vào ngày mai.');
    expect(result.giverRemaining).toBe(0);
    // Receiver must not be updated
    expect(updateSpy).toHaveBeenCalledTimes(1);
    expect(updateSpy).toHaveBeenCalledWith(
      { guildId: 'guild-1', userId: 'giver-1', repGivenToday: { $lt: 3 } },
      expect.any(Object),
      { new: true }
    );
  });

  it('rejects 4th rep attempt on the same day when quota is exhausted', async () => {
    const now = new Date('2026-10-01T14:00:00.000Z');

    // Giver already gave 3 reps today
    vi.spyOn(UserStatModel, 'findOne').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'giver-1',
      repGivenToday: 3,
      lastRepResetAt: new Date('2026-10-01T08:00:00.000Z')
    } as any);

    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');

    const result = await RepService.giveRep({
      guildId: 'guild-1',
      giverId: 'giver-1',
      receiverId: 'receiver-1',
      now
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Bạn đã dùng hết 3 lượt +rep hôm nay');
    expect(result.giverRemaining).toBe(0);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('resets quota when lastRepResetAt was on a previous calendar day (UTC+7)', async () => {
    // Yesterday in UTC+7: 2026-09-30 10:00 UTC+7 (03:00 UTC)
    const yesterday = new Date('2026-09-30T03:00:00.000Z');
    // Today in UTC+7: 2026-10-01 09:00 UTC+7 (02:00 UTC)
    const now = new Date('2026-10-01T02:00:00.000Z');

    vi.spyOn(UserStatModel, 'findOne').mockResolvedValueOnce({
      guildId: 'guild-1',
      userId: 'giver-1',
      repGivenToday: 3,
      lastRepResetAt: yesterday
    } as any);

    vi.spyOn(UserStatModel, 'findOneAndUpdate')
      .mockResolvedValueOnce({} as any)
      .mockResolvedValueOnce({
        guildId: 'guild-1',
        userId: 'receiver-1',
        repCount: 1
      } as any);

    const result = await RepService.giveRep({
      guildId: 'guild-1',
      giverId: 'giver-1',
      receiverId: 'receiver-1',
      now
    });

    expect(result.success).toBe(true);
    expect(result.giverRemaining).toBe(2);
    expect(result.receiverRepCount).toBe(1);

    expect(UserStatModel.findOneAndUpdate).toHaveBeenNthCalledWith(
      1,
      { guildId: 'guild-1', userId: 'giver-1' },
      {
        $set: { repGivenToday: 1, lastRepResetAt: now, updatedAt: now },
        $setOnInsert: { username: 'giver-1' }
      },
      { upsert: true }
    );
  });
});

describe('Rep Embed Builders', () => {
  it('creates success embed with receiver info, reason, updated rep count, and remaining quota', () => {
    const embed = createRepSuccessEmbed({
      giverId: 'giver-123',
      receiver: {
        id: 'receiver-456',
        username: 'BobTheBuilder',
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatars/456/bob.png'
      },
      receiverRepCount: 15,
      giverRemaining: 2,
      reason: 'Helped solve a tricky bug'
    });

    const data = embed.data;
    expect(data.title).toContain('+rep');
    expect(data.description).toContain('<@giver-123>');
    expect(data.description).toContain('<@receiver-456>');
    expect(data.thumbnail?.url).toBe('https://cdn.discordapp.com/avatars/456/bob.png');

    const reasonField = data.fields?.find((f) => f.name === 'Lý do');
    expect(reasonField?.value).toBe('Helped solve a tricky bug');

    const repField = data.fields?.find((f) => f.name.includes('uy tín') || f.name.includes('Danh tiếng') || f.name.includes('Tổng'));
    expect(repField?.value).toContain('15');

    const quotaField = data.fields?.find((f) => f.name.includes('Lượt còn lại') || f.name.includes('Còn lại'));
    expect(quotaField?.value).toContain('2/3');
  });

  it('truncates reason to 200 characters if longer than 200 characters', () => {
    const longReason = 'A'.repeat(250);
    const embed = createRepSuccessEmbed({
      giverId: 'giver-123',
      receiver: {
        id: 'receiver-456',
        username: 'BobTheBuilder'
      },
      receiverRepCount: 15,
      giverRemaining: 2,
      reason: longReason
    });

    const data = embed.data;
    const reasonField = data.fields?.find((f) => f.name === 'Lý do');
    expect(reasonField?.value.length).toBe(200);
    expect(reasonField?.value).toBe('A'.repeat(200));
  });

  it('creates error embed with given error message', () => {
    const embed = createRepErrorEmbed('Bạn đã dùng hết 3 lượt +rep hôm nay! Hãy quay lại vào ngày mai.');
    const data = embed.data;

    expect(data.title).toContain('Không thể +rep');
    expect(data.description).toContain('Bạn đã dùng hết 3 lượt +rep hôm nay');
  });
});

describe('/rep slash command (handleRepCommand)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects execution outside of guild (DM) with ephemeral message', async () => {
    const interaction = mockInteraction({ guildId: null });
    await handleRepCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Lệnh này chỉ dùng trong server Discord.',
      ephemeral: true
    });
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('rejects execution when target user is not provided', async () => {
    const interaction = mockInteraction({ targetUser: null });
    await handleRepCommand(interaction);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'Vui lòng chọn người dùng bạn muốn +rep!',
      ephemeral: true
    });
    expect(interaction.deferReply).not.toHaveBeenCalled();
  });

  it('handles self-rep rejection by deferring and editing reply with error embed', async () => {
    const interaction = mockInteraction({
      userId: 'user-same',
      targetUser: { id: 'user-same', username: 'Narcissus' } as User
    });

    await handleRepCommand(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalled();

    const editArgs = vi.mocked(interaction.editReply).mock.calls[0][0] as { embeds: any[] };
    expect(editArgs.embeds).toBeDefined();
    expect(editArgs.embeds.length).toBe(1);
    expect(editArgs.embeds[0].data.description).toContain('Bạn không thể tự +rep');
  });

  it('handles successful rep flow, calling deferReply and editing reply with success embed', async () => {
    vi.spyOn(RepService, 'giveRep').mockResolvedValueOnce({
      success: true,
      giverRemaining: 1,
      receiverRepCount: 8
    });

    const targetUser = {
      id: 'receiver-2',
      username: 'Bob',
      displayAvatarURL: vi.fn().mockReturnValue('https://example.com/bob.png')
    } as unknown as User;

    const interaction = mockInteraction({
      userId: 'giver-1',
      username: 'Alice',
      targetUser,
      reason: 'Thanks for the quick help'
    });

    await handleRepCommand(interaction);

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(RepService.giveRep).toHaveBeenCalledWith(
      expect.objectContaining({
        guildId: 'guild-1',
        giverId: 'giver-1',
        receiverId: 'receiver-2',
        reason: 'Thanks for the quick help'
      })
    );
    expect(interaction.editReply).toHaveBeenCalled();

    const editArgs = vi.mocked(interaction.editReply).mock.calls[0][0] as { embeds: any[] };
    expect(editArgs.embeds).toBeDefined();
    expect(editArgs.embeds.length).toBe(1);
    const embed = editArgs.embeds[0].data;
    expect(embed.description).toContain('<@giver-1>');
    expect(embed.description).toContain('<@receiver-2>');
  });

  it('truncates reason exceeding 200 characters when executing /rep slash command', async () => {
    vi.spyOn(RepService, 'giveRep').mockResolvedValueOnce({
      success: true,
      giverRemaining: 1,
      receiverRepCount: 8
    });

    const targetUser = {
      id: 'receiver-2',
      username: 'Bob',
      displayAvatarURL: vi.fn().mockReturnValue('https://example.com/bob.png')
    } as unknown as User;

    const longReason = 'x'.repeat(250);
    const interaction = mockInteraction({
      userId: 'giver-1',
      username: 'Alice',
      targetUser,
      reason: longReason
    });

    await handleRepCommand(interaction);

    expect(RepService.giveRep).toHaveBeenCalledWith(
      expect.objectContaining({
        reason: 'x'.repeat(200)
      })
    );

    const editArgs = vi.mocked(interaction.editReply).mock.calls[0][0] as { embeds: any[] };
    const embed = editArgs.embeds[0].data;
    const reasonField = embed.fields?.find((f: any) => f.name === 'Lý do');
    expect(reasonField?.value).toBe('x'.repeat(200));
    expect(reasonField?.value.length).toBe(200);
  });

  it('handles unexpected exceptions cleanly without throwing unhandled rejection', async () => {
    vi.spyOn(RepService, 'giveRep').mockRejectedValueOnce(new Error('DB Timeout'));

    const interaction = mockInteraction();
    await expect(handleRepCommand(interaction)).resolves.not.toThrow();

    expect(interaction.deferReply).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: 'Hiện không thể thực hiện +rep. Vui lòng thử lại sau.'
    });
  });
});
