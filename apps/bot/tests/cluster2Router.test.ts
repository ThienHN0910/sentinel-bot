import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction, ChatInputCommandInteraction, ModalSubmitInteraction } from 'discord.js';
import { slashCommands } from '../src/events/ready.js';
import { onInteractionCreate } from '../src/events/interactionCreate.js';
import { handleHelpCommand } from '../src/commands/help.js';
import * as commandsIndex from '../src/commands/index.js';
import {
  handleConfessCommand,
  handleConfessModalSubmit,
  handleConfessButton,
  handleDirectMessageConfession
} from '../src/commands/confess.js';
import { handleBetCommand, handleBetButton } from '../src/commands/bet.js';
import { handleQotdCommand, handleQotdButton } from '../src/commands/qotd.js';

vi.mock('../src/commands/confess.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/commands/confess.js')>();
  return {
    ...actual,
    handleConfessCommand: vi.fn().mockResolvedValue(undefined),
    handleConfessModalSubmit: vi.fn().mockResolvedValue(undefined),
    handleConfessButton: vi.fn().mockResolvedValue(undefined),
    handleDirectMessageConfession: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('../src/commands/bet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/commands/bet.js')>();
  return {
    ...actual,
    handleBetCommand: vi.fn().mockResolvedValue(undefined),
    handleBetButton: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('../src/commands/qotd.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/commands/qotd.js')>();
  return {
    ...actual,
    handleQotdCommand: vi.fn().mockResolvedValue(undefined),
    handleQotdButton: vi.fn().mockResolvedValue(undefined)
  };
});

function createMockChatInputInteraction(commandName: string) {
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    commandName,
    guildId: 'guild-test-123',
    user: { id: 'user-test-456', username: 'Tester' },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  } as unknown as ChatInputCommandInteraction;
}

function createMockButtonInteraction(customId: string) {
  return {
    isChatInputCommand: () => false,
    isButton: () => true,
    isModalSubmit: () => false,
    customId,
    guildId: 'guild-test-123',
    user: { id: 'user-test-456', username: 'Tester' },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  } as unknown as ButtonInteraction;
}

function createMockModalSubmitInteraction(customId: string) {
  return {
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => true,
    customId,
    guildId: 'guild-test-123',
    user: { id: 'user-test-456', username: 'Tester' },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  } as unknown as ModalSubmitInteraction;
}

describe('Cluster 2 Router & Command Registration Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('slashCommands in ready.ts', () => {
    describe('/confess command definition', () => {
      it('registers /confess command with send, config, and delete subcommands', () => {
        const confessCmd = slashCommands.find((cmd) => cmd.name === 'confess');
        expect(confessCmd).toBeDefined();
        expect(confessCmd?.description).toBe('Gửi tin nhắn ẩn danh vào kênh confession của server');

        const sendSub = confessCmd?.options?.find((opt: any) => opt.name === 'send');
        expect(sendSub).toBeDefined();
        expect(sendSub?.description).toBe('Gửi confession ẩn danh qua form nhập liệu');

        const configSub = confessCmd?.options?.find((opt: any) => opt.name === 'config');
        expect(configSub).toBeDefined();
        expect(configSub?.description).toBe('Cấu hình kênh nhận confession (Admin)');
        const channelOpt = (configSub as any)?.options?.find((opt: any) => opt.name === 'channel');
        expect(channelOpt).toBeDefined();
        expect(channelOpt?.description).toBe('Kênh text nhận confession');
        expect(channelOpt?.required).toBe(true);

        const deleteSub = confessCmd?.options?.find((opt: any) => opt.name === 'delete');
        expect(deleteSub).toBeDefined();
        expect(deleteSub?.description).toBe('Xóa bài confession theo ID (Admin)');
        const idOpt = (deleteSub as any)?.options?.find((opt: any) => opt.name === 'id');
        expect(idOpt).toBeDefined();
        expect(idOpt?.description).toBe('Mã số confession (#ID)');
        expect(idOpt?.required).toBe(true);
      });
    });

    describe('/bet command definition', () => {
      it('registers /bet command with full suite of 1v1 and pool subcommands', () => {
        const betCmd = slashCommands.find((cmd) => cmd.name === 'bet');
        expect(betCmd).toBeDefined();
        expect(betCmd?.description).toBe('Hệ thống cá cược: thách đấu 1v1 hoặc tạo kèo cộng đồng');

        // Subcommand: challenge
        const challengeSub = betCmd?.options?.find((opt: any) => opt.name === 'challenge');
        expect(challengeSub).toBeDefined();
        expect(challengeSub?.description).toBe('Thách đấu 1v1 với thành viên khác');
        const userOpt = (challengeSub as any)?.options?.find((opt: any) => opt.name === 'user');
        expect(userOpt?.required).toBe(true);
        const amountOpt = (challengeSub as any)?.options?.find((opt: any) => opt.name === 'amount');
        expect(amountOpt?.required).toBe(true);
        expect(amountOpt?.min_value).toBe(10);
        const titleOpt = (challengeSub as any)?.options?.find((opt: any) => opt.name === 'title');
        expect(titleOpt?.required).toBe(true);
        expect(titleOpt?.max_length).toBe(200);
        const pickOpt = (challengeSub as any)?.options?.find((opt: any) => opt.name === 'pick');
        expect(pickOpt?.required).toBe(true);
        expect(pickOpt?.max_length).toBe(50);

        // Subcommand: accept
        const acceptSub = betCmd?.options?.find((opt: any) => opt.name === 'accept');
        expect(acceptSub).toBeDefined();
        expect(acceptSub?.description).toBe('Chấp nhận lời thách đấu 1v1');
        const acceptIdOpt = (acceptSub as any)?.options?.find((opt: any) => opt.name === 'id');
        expect(acceptIdOpt?.required).toBe(true);

        // Subcommand: cancel
        const cancelSub = betCmd?.options?.find((opt: any) => opt.name === 'cancel');
        expect(cancelSub).toBeDefined();
        expect(cancelSub?.description).toBe('Hủy hoặc từ chối kèo thách đấu 1v1');
        const cancelIdOpt = (cancelSub as any)?.options?.find((opt: any) => opt.name === 'id');
        expect(cancelIdOpt?.required).toBe(true);

        // Subcommand: pool-create
        const poolCreateSub = betCmd?.options?.find((opt: any) => opt.name === 'pool-create');
        expect(poolCreateSub).toBeDefined();
        expect(poolCreateSub?.description).toBe('Tạo kèo cá cược cộng đồng');
        const pcTitleOpt = (poolCreateSub as any)?.options?.find((opt: any) => opt.name === 'title');
        expect(pcTitleOpt?.required).toBe(true);
        expect(pcTitleOpt?.max_length).toBe(200);
        const pcOptionsOpt = (poolCreateSub as any)?.options?.find((opt: any) => opt.name === 'options');
        expect(pcOptionsOpt?.required).toBe(true);
        const pcDurationOpt = (poolCreateSub as any)?.options?.find((opt: any) => opt.name === 'duration');
        expect(pcDurationOpt?.required).toBe(false);

        // Subcommand: pool-join
        const poolJoinSub = betCmd?.options?.find((opt: any) => opt.name === 'pool-join');
        expect(poolJoinSub).toBeDefined();
        expect(poolJoinSub?.description).toBe('Đặt cược vào kèo cộng đồng');
        const pjIdOpt = (poolJoinSub as any)?.options?.find((opt: any) => opt.name === 'id');
        expect(pjIdOpt?.required).toBe(true);
        const pjOptionOpt = (poolJoinSub as any)?.options?.find((opt: any) => opt.name === 'option');
        expect(pjOptionOpt?.required).toBe(true);
        const pjAmountOpt = (poolJoinSub as any)?.options?.find((opt: any) => opt.name === 'amount');
        expect(pjAmountOpt?.required).toBe(true);
        expect(pjAmountOpt?.min_value).toBe(10);

        // Subcommand: pool-resolve
        const poolResolveSub = betCmd?.options?.find((opt: any) => opt.name === 'pool-resolve');
        expect(poolResolveSub).toBeDefined();
        expect(poolResolveSub?.description).toBe('Kết toán và trả thưởng kèo cộng đồng (Admin/Host)');
        const prIdOpt = (poolResolveSub as any)?.options?.find((opt: any) => opt.name === 'id');
        expect(prIdOpt?.required).toBe(true);
        const prWinnerOpt = (poolResolveSub as any)?.options?.find((opt: any) => opt.name === 'winner');
        expect(prWinnerOpt?.required).toBe(true);

        // Subcommand: p2p-resolve
        const p2pResolveSub = betCmd?.options?.find((opt: any) => opt.name === 'p2p-resolve');
        expect(p2pResolveSub).toBeDefined();
        expect(p2pResolveSub?.description).toBe('Kết toán kèo thách đấu 1v1 (Admin hoặc người tham gia)');
        const p2pIdOpt = (p2pResolveSub as any)?.options?.find((opt: any) => opt.name === 'id');
        expect(p2pIdOpt?.required).toBe(true);
        const p2pWinnerOpt = (p2pResolveSub as any)?.options?.find((opt: any) => opt.name === 'winner');
        expect(p2pWinnerOpt?.required).toBe(true);
      });
    });

    describe('/qotd command definition', () => {
      it('registers /qotd command with today, config, and post subcommands', () => {
        const qotdCmd = slashCommands.find((cmd) => cmd.name === 'qotd');
        expect(qotdCmd).toBeDefined();
        expect(qotdCmd?.description).toBe(
          'Câu hỏi hằng ngày (Would You Rather, This/That, Trivia thưởng coin + XP)'
        );

        const todaySub = qotdCmd?.options?.find((opt: any) => opt.name === 'today');
        expect(todaySub).toBeDefined();
        expect(todaySub?.description).toBe('Xem câu hỏi hôm nay và tỷ lệ bình chọn');

        const configSub = qotdCmd?.options?.find((opt: any) => opt.name === 'config');
        expect(configSub).toBeDefined();
        expect(configSub?.description).toBe('Cấu hình kênh nhận câu hỏi hằng ngày (Admin)');
        const channelOpt = (configSub as any)?.options?.find((opt: any) => opt.name === 'channel');
        expect(channelOpt).toBeDefined();
        expect(channelOpt?.description).toBe('Kênh text nhận QOTD');
        expect(channelOpt?.required).toBe(true);

        const postSub = qotdCmd?.options?.find((opt: any) => opt.name === 'post');
        expect(postSub).toBeDefined();
        expect(postSub?.description).toBe('Đăng câu hỏi hôm nay thủ công (Admin)');
      });
    });
  });

  describe('commands/index.ts re-exports', () => {
    it('re-exports confession handlers', () => {
      expect(commandsIndex).toHaveProperty('handleConfessCommand');
      expect(typeof (commandsIndex as any).handleConfessCommand).toBe('function');
      expect(commandsIndex).toHaveProperty('handleConfessModalSubmit');
      expect(typeof (commandsIndex as any).handleConfessModalSubmit).toBe('function');
      expect(commandsIndex).toHaveProperty('handleConfessButton');
      expect(typeof (commandsIndex as any).handleConfessButton).toBe('function');
      expect(commandsIndex).toHaveProperty('handleDirectMessageConfession');
      expect(typeof (commandsIndex as any).handleDirectMessageConfession).toBe('function');
    });

    it('re-exports bet handlers', () => {
      expect(commandsIndex).toHaveProperty('handleBetCommand');
      expect(typeof (commandsIndex as any).handleBetCommand).toBe('function');
      expect(commandsIndex).toHaveProperty('handleBetButton');
      expect(typeof (commandsIndex as any).handleBetButton).toBe('function');
    });

    it('re-exports qotd handlers', () => {
      expect(commandsIndex).toHaveProperty('handleQotdCommand');
      expect(typeof (commandsIndex as any).handleQotdCommand).toBe('function');
      expect(commandsIndex).toHaveProperty('handleQotdButton');
      expect(typeof (commandsIndex as any).handleQotdButton).toBe('function');
    });
  });

  describe('onInteractionCreate routing', () => {
    it('routes /confess chat input to handleConfessCommand', async () => {
      const interaction = createMockChatInputInteraction('confess');
      await onInteractionCreate(interaction as any);
      expect(handleConfessCommand).toHaveBeenCalledTimes(1);
      expect(handleConfessCommand).toHaveBeenCalledWith(interaction);
    });

    it('routes /bet chat input to handleBetCommand', async () => {
      const interaction = createMockChatInputInteraction('bet');
      await onInteractionCreate(interaction as any);
      expect(handleBetCommand).toHaveBeenCalledTimes(1);
      expect(handleBetCommand).toHaveBeenCalledWith(interaction);
    });

    it('routes /qotd chat input to handleQotdCommand', async () => {
      const interaction = createMockChatInputInteraction('qotd');
      await onInteractionCreate(interaction as any);
      expect(handleQotdCommand).toHaveBeenCalledTimes(1);
      expect(handleQotdCommand).toHaveBeenCalledWith(interaction);
    });

    it('routes confess_modal submission to handleConfessModalSubmit', async () => {
      const interaction = createMockModalSubmitInteraction('confess_modal');
      await onInteractionCreate(interaction as any);
      expect(handleConfessModalSubmit).toHaveBeenCalledTimes(1);
      expect(handleConfessModalSubmit).toHaveBeenCalledWith(interaction);
    });

    it('routes confess:* button clicks to handleConfessButton', async () => {
      const interaction = createMockButtonInteraction('confess:react:heart:1');
      await onInteractionCreate(interaction as any);
      expect(handleConfessButton).toHaveBeenCalledTimes(1);
      expect(handleConfessButton).toHaveBeenCalledWith(interaction);
    });

    it('routes bet:* button clicks to handleBetButton', async () => {
      const interaction = createMockButtonInteraction('bet:p2p:accept:bet-123');
      await onInteractionCreate(interaction as any);
      expect(handleBetButton).toHaveBeenCalledTimes(1);
      expect(handleBetButton).toHaveBeenCalledWith(interaction);
    });

    it('routes qotd:* button clicks to handleQotdButton', async () => {
      const interaction = createMockButtonInteraction('qotd:vote:2026-10-01:A');
      await onInteractionCreate(interaction as any);
      expect(handleQotdButton).toHaveBeenCalledTimes(1);
      expect(handleQotdButton).toHaveBeenCalledWith(interaction);
    });
  });

  describe('/help command integration', () => {
    it('includes /confess, /bet, and /qotd in /help output', async () => {
      const interaction = createMockChatInputInteraction('help');
      await handleHelpCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const callArgs = (interaction.reply as any).mock.calls[0][0];
      expect(callArgs.content).toContain(
        '/confess — Gửi tin nhắn ẩn danh vào kênh confession của server'
      );
      expect(callArgs.content).toContain(
        '/bet — Hệ thống cá cược: thách đấu 1v1 hoặc tạo kèo cộng đồng'
      );
      expect(callArgs.content).toContain(
        '/qotd — Câu hỏi hằng ngày (Would You Rather, This/That, Trivia thưởng coin + XP)'
      );
    });
  });
});
