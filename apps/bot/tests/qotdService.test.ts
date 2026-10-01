import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction, ChatInputCommandInteraction, Client, TextChannel } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import { GuildConfigModel } from '../src/models/GuildConfig.js';
import { UserStatModel } from '../src/models/UserStat.js';
import { DailyQuestionModel } from '../src/models/DailyQuestion.js';
import { DailyQuestionService } from '../src/services/qotd/DailyQuestionService.js';
import { handleQotdButton, handleQotdCommand, qotdSlashCommand } from '../src/commands/qotd.js';
import { QuestionBankItem } from '@sentinel/shared';
import questionsJson from '../../packages/shared/src/constants/questions.json';

function createMockChatInputInteraction(options: {
  subcommand: string;
  subcommandGroup?: string;
  guildId?: string;
  channelOption?: { id: string; name: string };
  hasManageGuild?: boolean;
}): Partial<ChatInputCommandInteraction> {
  const { subcommand, subcommandGroup, guildId = 'guild-test-1', channelOption, hasManageGuild = true } = options;

  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    commandName: 'qotd',
    guildId,
    user: { id: 'admin-user-1', username: 'AdminUser' } as any,
    member: {
      permissions: {
        has: vi.fn().mockImplementation((perm: bigint) => {
          if (perm === PermissionFlagsBits.ManageGuild) {
            return hasManageGuild;
          }
          return false;
        })
      }
    } as any,
    options: {
      getSubcommandGroup: () => subcommandGroup ?? null,
      getSubcommand: () => subcommand,
      getChannel: (name: string) => {
        if (name === 'channel' && channelOption) {
          return channelOption as any;
        }
        return null;
      }
    } as any,
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    client: {
      channels: {
        fetch: vi.fn()
      }
    } as any
  };
}

function createMockButtonInteraction(options: {
  customId: string;
  guildId?: string;
  userId?: string;
  username?: string;
}): Partial<ButtonInteraction> {
  const { customId, guildId = 'guild-test-1', userId = 'user-1', username = 'Voter1' } = options;

  return {
    isChatInputCommand: () => false,
    isButton: () => true,
    customId,
    guildId,
    user: { id: userId, username } as any,
    reply: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn().mockResolvedValue(undefined),
    message: {
      id: 'message-123',
      edit: vi.fn().mockResolvedValue(undefined)
    } as any
  };
}

describe('QOTD System & DailyQuestionService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('Question Bank Integrity (questions.json)', () => {
    it('contains at least 15 valid questions across wyr, this_that, and trivia', () => {
      expect(Array.isArray(questionsJson)).toBe(true);
      expect(questionsJson.length).toBeGreaterThanOrEqual(15);

      const types = new Set(questionsJson.map((q: QuestionBankItem) => q.type));
      expect(types.has('wyr')).toBe(true);
      expect(types.has('this_that')).toBe(true);
      expect(types.has('trivia')).toBe(true);

      for (const item of questionsJson as QuestionBankItem[]) {
        expect(item.id).toBeTruthy();
        expect(['wyr', 'this_that', 'trivia']).toContain(item.type);
        expect(typeof item.prompt).toBe('string');
        expect(item.prompt.trim().length).toBeGreaterThan(0);
        expect(Array.isArray(item.options)).toBe(true);
        expect(item.options.length).toBeGreaterThanOrEqual(2);

        for (const opt of item.options) {
          expect(opt.key).toBeTruthy();
          expect(opt.label).toBeTruthy();
        }

        if (item.type === 'trivia') {
          expect(item.correctKey).toBeTruthy();
          const keys = item.options.map((o) => o.key);
          expect(keys).toContain(item.correctKey);
        }
      }
    });

    it('returns a random question matching the requested type or any type', () => {
      const anyQuestion = DailyQuestionService.getRandomQuestion();
      expect(anyQuestion).toBeDefined();
      expect(anyQuestion.id).toBeTruthy();

      const triviaQuestion = DailyQuestionService.getRandomQuestion('trivia');
      expect(triviaQuestion.type).toBe('trivia');
      expect(triviaQuestion.correctKey).toBeDefined();

      const wyrQuestion = DailyQuestionService.getRandomQuestion('wyr');
      expect(wyrQuestion.type).toBe('wyr');
    });

    it('formats date string in Asia/Ho_Chi_Minh timezone (UTC+7)', () => {
      // 2026-10-01 18:00 UTC = 2026-10-02 01:00 in UTC+7
      const date1 = new Date('2026-10-01T18:00:00Z');
      expect(DailyQuestionService.getTodayDateString(date1)).toBe('2026-10-02');

      // 2026-10-01 02:00 UTC = 2026-10-01 09:00 in UTC+7
      const date2 = new Date('2026-10-01T02:00:00Z');
      expect(DailyQuestionService.getTodayDateString(date2)).toBe('2026-10-01');
    });
  });

  describe('Daily Question Posting & Single-Delivery per Day', () => {
    it('throws error if qotdChannelId is not configured in GuildConfig', async () => {
      vi.spyOn(DailyQuestionModel, 'findOne').mockResolvedValue(null as never);
      vi.spyOn(GuildConfigModel, 'findOne').mockResolvedValue({
        guildId: 'guild-test-1',
        qotdChannelId: null
      } as never);

      const mockClient = {
        channels: { fetch: vi.fn() }
      } as unknown as Client;

      await expect(
        DailyQuestionService.postDailyQuestion({
          guildId: 'guild-test-1',
          client: mockClient,
          now: new Date('2026-10-01T03:00:00Z')
        })
      ).rejects.toThrow('QOTD channel is not configured');
    });

    it('posts question to Discord channel and saves to DailyQuestionModel', async () => {
      vi.spyOn(DailyQuestionModel, 'findOne').mockResolvedValue(null as never);
      vi.spyOn(GuildConfigModel, 'findOne').mockResolvedValue({
        guildId: 'guild-test-1',
        qotdChannelId: 'channel-123'
      } as never);

      const mockSend = vi.fn().mockResolvedValue({ id: 'msg-456' });
      const mockChannel = {
        id: 'channel-123',
        isTextBased: () => true,
        send: mockSend
      } as unknown as TextChannel;

      const mockClient = {
        channels: {
          fetch: vi.fn().mockResolvedValue(mockChannel)
        }
      } as unknown as Client;

      const mockCreated = {
        guildId: 'guild-test-1',
        date: '2026-10-01',
        type: 'wyr',
        question: 'Prompt?',
        options: [
          { key: 'A', label: 'Opt A', votes: [] },
          { key: 'B', label: 'Opt B', votes: [] }
        ],
        rewardedUserIds: [],
        messageId: 'msg-456',
        channelId: 'channel-123'
      };

      const createSpy = vi.spyOn(DailyQuestionModel, 'create').mockResolvedValue(mockCreated as never);

      const forceQuestion: QuestionBankItem = {
        id: 'test-wyr-1',
        type: 'wyr',
        prompt: 'Thà biết bay hay tàng hình?',
        options: [
          { key: 'A', label: 'Biết bay' },
          { key: 'B', label: 'Tàng hình' }
        ]
      };

      const result = await DailyQuestionService.postDailyQuestion({
        guildId: 'guild-test-1',
        client: mockClient,
        forceQuestion,
        now: new Date('2026-10-01T03:00:00Z')
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-test-1',
          date: '2026-10-01',
          type: 'wyr',
          messageId: 'msg-456',
          channelId: 'channel-123'
        })
      );
      expect(result.messageId).toBe('msg-456');
    });

    it('single-delivery: returns existing question without sending another message if already posted today', async () => {
      const existingDoc = {
        guildId: 'guild-test-1',
        date: '2026-10-01',
        type: 'wyr',
        question: 'Already posted today',
        options: [],
        rewardedUserIds: [],
        messageId: 'existing-msg',
        channelId: 'channel-123'
      };

      vi.spyOn(DailyQuestionModel, 'findOne').mockResolvedValue(existingDoc as never);
      const configSpy = vi.spyOn(GuildConfigModel, 'findOne');

      const mockSend = vi.fn();
      const mockClient = {
        channels: { fetch: vi.fn() }
      } as unknown as Client;

      const result = await DailyQuestionService.postDailyQuestion({
        guildId: 'guild-test-1',
        client: mockClient,
        now: new Date('2026-10-01T03:00:00Z')
      });

      expect(result).toBe(existingDoc);
      expect(configSpy).not.toHaveBeenCalled();
      expect(mockSend).not.toHaveBeenCalled();
    });
  });

  describe('Voting in WYR and This/That', () => {
    it('records vote and allows switching options dynamically', async () => {
      const mockQuestion = {
        guildId: 'guild-test-1',
        date: '2026-10-01',
        type: 'wyr',
        question: 'Trà sữa hay Cà phê?',
        options: [
          { key: 'A', label: 'Trà sữa', votes: ['user-other'] },
          { key: 'B', label: 'Cà phê', votes: [] }
        ],
        rewardedUserIds: [],
        save: vi.fn().mockResolvedValue(true)
      };

      vi.spyOn(DailyQuestionModel, 'findOne').mockResolvedValue(mockQuestion as never);

      // User 1 votes A
      const vote1 = await DailyQuestionService.recordVote({
        guildId: 'guild-test-1',
        date: '2026-10-01',
        userId: 'user-1',
        username: 'UserOne',
        optionKey: 'A'
      });

      expect(vote1.success).toBe(true);
      expect(mockQuestion.options[0].votes).toContain('user-1');
      expect(mockQuestion.save).toHaveBeenCalled();

      // User 1 switches to B
      const vote2 = await DailyQuestionService.recordVote({
        guildId: 'guild-test-1',
        date: '2026-10-01',
        userId: 'user-1',
        username: 'UserOne',
        optionKey: 'B'
      });

      expect(vote2.success).toBe(true);
      expect(mockQuestion.options[0].votes).not.toContain('user-1');
      expect(mockQuestion.options[1].votes).toContain('user-1');
      // No coins or xp awarded for WYR
      expect(vote2.rewardEarned).toBeFalsy();
    });
  });

  describe('Trivia Voting & Atomic Coin + XP Rewards', () => {
    it('locks choice on trivia: correct answer awards 50 DNE + 20 XP atomically', async () => {
      const mockQuestion = {
        guildId: 'guild-test-1',
        date: '2026-10-01',
        type: 'trivia',
        question: 'Thủ đô của Việt Nam là gì?',
        options: [
          { key: 'A', label: 'Hà Nội', votes: [] },
          { key: 'B', label: 'Đà Nẵng', votes: [] },
          { key: 'C', label: 'TP.HCM', votes: [] },
          { key: 'D', label: 'Huế', votes: [] }
        ],
        correctAnswerKey: 'A',
        rewardedUserIds: []
      };

      const updatedQuestion = {
        ...mockQuestion,
        options: [
          { key: 'A', label: 'Hà Nội', votes: ['user-1'] },
          { key: 'B', label: 'Đà Nẵng', votes: [] },
          { key: 'C', label: 'TP.HCM', votes: [] },
          { key: 'D', label: 'Huế', votes: [] }
        ]
      };

      const rewardedDoc = {
        ...updatedQuestion,
        rewardedUserIds: ['user-1']
      };

      vi.spyOn(DailyQuestionModel, 'findOne').mockResolvedValue(mockQuestion as never);
      vi.spyOn(DailyQuestionModel, 'findOneAndUpdate')
        .mockResolvedValueOnce(updatedQuestion as never) // vote
        .mockResolvedValueOnce(rewardedDoc as never) // reward
        .mockResolvedValueOnce(null as never); // subsequent vote attempt returns null

      const userStatUpdateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({
        guildId: 'guild-test-1',
        userId: 'user-1',
        dneCoins: 150,
        exp: 20
      } as never);

      // User votes correct answer A
      const res = await DailyQuestionService.recordVote({
        guildId: 'guild-test-1',
        date: '2026-10-01',
        userId: 'user-1',
        username: 'UserOne',
        optionKey: 'A'
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(true);
      expect(res.rewardEarned).toBe(true);
      expect(res.question.rewardedUserIds).toContain('user-1');
      expect(res.question.options[0].votes).toContain('user-1');

      // Atomic update verified: 50 DNE coins + 20 XP
      expect(userStatUpdateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-test-1', userId: 'user-1' },
        expect.objectContaining({
          $inc: { dneCoins: 50, exp: 20 }
        }),
        expect.objectContaining({ upsert: true, new: true })
      );

      // User tries to vote again -> choice is locked!
      const resSecond = await DailyQuestionService.recordVote({
        guildId: 'guild-test-1',
        date: '2026-10-01',
        userId: 'user-1',
        username: 'UserOne',
        optionKey: 'B'
      });

      expect(resSecond.success).toBe(false);
      expect(resSecond.error).toMatch(/đã trả lời/i);
    });

    it('locks choice on trivia: wrong answer does NOT award coins/xp and cannot be changed', async () => {
      const mockQuestion = {
        guildId: 'guild-test-1',
        date: '2026-10-01',
        type: 'trivia',
        question: 'Thủ đô của Việt Nam là gì?',
        options: [
          { key: 'A', label: 'Hà Nội', votes: [] },
          { key: 'B', label: 'Đà Nẵng', votes: [] }
        ],
        correctAnswerKey: 'A',
        rewardedUserIds: []
      };

      const updatedQuestion = {
        ...mockQuestion,
        options: [
          { key: 'A', label: 'Hà Nội', votes: [] },
          { key: 'B', label: 'Đà Nẵng', votes: ['user-2'] }
        ]
      };

      vi.spyOn(DailyQuestionModel, 'findOne').mockResolvedValue(mockQuestion as never);
      vi.spyOn(DailyQuestionModel, 'findOneAndUpdate')
        .mockResolvedValueOnce(updatedQuestion as never)
        .mockResolvedValueOnce(null as never);
      const userStatUpdateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');

      // User votes wrong answer B
      const res = await DailyQuestionService.recordVote({
        guildId: 'guild-test-1',
        date: '2026-10-01',
        userId: 'user-2',
        username: 'UserTwo',
        optionKey: 'B'
      });

      expect(res.success).toBe(true);
      expect(res.isCorrect).toBe(false);
      expect(res.rewardEarned).toBeFalsy();
      expect(userStatUpdateSpy).not.toHaveBeenCalled();

      // Subsequent attempt is locked
      const resSecond = await DailyQuestionService.recordVote({
        guildId: 'guild-test-1',
        date: '2026-10-01',
        userId: 'user-2',
        username: 'UserTwo',
        optionKey: 'A'
      });

      expect(resSecond.success).toBe(false);
      expect(userStatUpdateSpy).not.toHaveBeenCalled();
    });

    it('prevents duplicate rewards if user already received reward or concurrent reward failed', async () => {
      const mockQuestion = {
        guildId: 'guild-test-1',
        date: '2026-10-01',
        type: 'trivia',
        question: 'Thủ đô của Việt Nam là gì?',
        options: [
          { key: 'A', label: 'Hà Nội', votes: [] }
        ],
        correctAnswerKey: 'A',
        rewardedUserIds: ['user-1']
      };

      const updatedQuestion = {
        ...mockQuestion,
        options: [{ key: 'A', label: 'Hà Nội', votes: ['user-1'] }]
      };

      vi.spyOn(DailyQuestionModel, 'findOne').mockResolvedValue(mockQuestion as never);
      vi.spyOn(DailyQuestionModel, 'findOneAndUpdate')
        .mockResolvedValueOnce(updatedQuestion as never) // vote
        .mockResolvedValueOnce(null as never); // reward doc returns null
      const userStatUpdateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');

      const res = await DailyQuestionService.recordVote({
        guildId: 'guild-test-1',
        date: '2026-10-01',
        userId: 'user-1',
        username: 'UserOne',
        optionKey: 'A'
      });

      expect(res.rewardEarned).toBe(false);
      expect(userStatUpdateSpy).not.toHaveBeenCalled();
    });

    it('prevents double voting in trivia when concurrent requests are sent', async () => {
      const mockQuestion = {
        guildId: 'guild-test-1',
        date: '2026-10-01',
        type: 'trivia',
        question: 'Thủ đô của Việt Nam là gì?',
        options: [{ key: 'A', label: 'Hà Nội', votes: [] }],
        correctAnswerKey: 'A',
        rewardedUserIds: []
      };

      vi.spyOn(DailyQuestionModel, 'findOne').mockResolvedValue(mockQuestion as never);
      vi.spyOn(DailyQuestionModel, 'findOneAndUpdate').mockResolvedValue(null as never);

      const res = await DailyQuestionService.recordVote({
        guildId: 'guild-test-1',
        date: '2026-10-01',
        userId: 'user-1',
        username: 'UserOne',
        optionKey: 'A'
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/đã trả lời/i);
    });
  });

  describe('Slash Command & Button Interaction Routing (/qotd)', () => {
    it('defines slash command /qotd with today, post, and config subcommands', () => {
      const json = qotdSlashCommand.toJSON();
      expect(json.name).toBe('qotd');
      const subcommands = json.options?.map((opt: any) => opt.name);
      expect(subcommands).toContain('today');
      expect(subcommands).toContain('post');
      expect(subcommands).toContain('config');
    });

    it('/qotd config updates qotdChannelId when user has ManageGuild permission', async () => {
      const updateSpy = vi.spyOn(GuildConfigModel, 'findOneAndUpdate').mockResolvedValue({
        guildId: 'guild-test-1',
        qotdChannelId: 'channel-789'
      } as never);

      const interaction = createMockChatInputInteraction({
        subcommand: 'config',
        channelOption: { id: 'channel-789', name: 'qotd-chat' },
        hasManageGuild: true
      });

      await handleQotdCommand(interaction as ChatInputCommandInteraction);

      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-test-1' },
        expect.objectContaining({ $set: expect.objectContaining({ qotdChannelId: 'channel-789' }) }),
        expect.objectContaining({ upsert: true })
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('channel-789') })
      );
    });

    it('/qotd config rejects users without ManageGuild permission', async () => {
      const updateSpy = vi.spyOn(GuildConfigModel, 'findOneAndUpdate');

      const interaction = createMockChatInputInteraction({
        subcommand: 'config',
        channelOption: { id: 'channel-789', name: 'qotd-chat' },
        hasManageGuild: false
      });

      await handleQotdCommand(interaction as ChatInputCommandInteraction);

      expect(updateSpy).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('quyền'),
          ephemeral: true
        })
      );
    });

    it('/qotd post manually triggers postDailyQuestion for admins', async () => {
      const postSpy = vi.spyOn(DailyQuestionService, 'postDailyQuestion').mockResolvedValue({
        guildId: 'guild-test-1',
        date: '2026-10-01',
        type: 'wyr',
        question: 'Sample',
        options: [],
        rewardedUserIds: [],
        messageId: 'msg-1',
        channelId: 'chan-1'
      } as never);

      const interaction = createMockChatInputInteraction({
        subcommand: 'post',
        hasManageGuild: true
      });

      await handleQotdCommand(interaction as ChatInputCommandInteraction);

      expect(postSpy).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: 'guild-test-1', client: interaction.client })
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.stringContaining('thành công') })
      );
    });

    it('/qotd today displays current question if already posted', async () => {
      vi.spyOn(DailyQuestionModel, 'findOne').mockResolvedValue({
        guildId: 'guild-test-1',
        date: '2026-10-01',
        type: 'wyr',
        question: 'Học code sáng hay tối?',
        options: [
          { key: 'A', label: 'Sáng', votes: ['u1'] },
          { key: 'B', label: 'Tối', votes: ['u2', 'u3'] }
        ],
        rewardedUserIds: [],
        messageId: 'msg-1',
        channelId: 'chan-1'
      } as never);

      const interaction = createMockChatInputInteraction({
        subcommand: 'today'
      });

      await handleQotdCommand(interaction as ChatInputCommandInteraction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });

    it('handleQotdButton processes button click and edits message', async () => {
      vi.spyOn(DailyQuestionService, 'recordVote').mockResolvedValue({
        success: true,
        isCorrect: true,
        rewardEarned: true,
        question: {
          guildId: 'guild-test-1',
          date: '2026-10-01',
          type: 'trivia',
          question: 'Capital of VN?',
          options: [{ key: 'A', label: 'Hà Nội', votes: ['user-1'] }],
          rewardedUserIds: ['user-1'],
          messageId: 'message-123',
          channelId: 'channel-123'
        }
      });

      const interaction = createMockButtonInteraction({
        customId: 'qotd:vote:2026-10-01:A',
        userId: 'user-1'
      });

      await handleQotdButton(interaction as ButtonInteraction);

      expect(DailyQuestionService.recordVote).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-test-1',
          date: '2026-10-01',
          userId: 'user-1',
          optionKey: 'A'
        })
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('+50 DNE Coins'),
          ephemeral: true
        })
      );
      expect(interaction.message?.edit).toHaveBeenCalled();
    });
  });
});
