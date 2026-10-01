import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { slashCommands } from '../src/events/ready.js';
import { onInteractionCreate } from '../src/events/interactionCreate.js';
import { handleHelpCommand } from '../src/commands/help.js';
import * as commandsIndex from '../src/commands/index.js';
import { handleDailyCommand } from '../src/commands/daily.js';
import { handleRepCommand } from '../src/commands/rep.js';
import { handleGachaCommand } from '../src/commands/gacha.js';

vi.mock('../src/commands/daily.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/commands/daily.js')>();
  return {
    ...actual,
    handleDailyCommand: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('../src/commands/rep.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/commands/rep.js')>();
  return {
    ...actual,
    handleRepCommand: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('../src/commands/gacha.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/commands/gacha.js')>();
  return {
    ...actual,
    handleGachaCommand: vi.fn().mockResolvedValue(undefined)
  };
});

function createMockChatInputInteraction(commandName: string) {
  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    commandName,
    guildId: 'guild-test-123',
    user: { id: 'user-test-456', username: 'Tester' },
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  } as unknown as ChatInputCommandInteraction;
}

describe('Command Router & Registration Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('slashCommands in ready.ts', () => {
    it('registers /daily command with correct description', () => {
      const dailyCmd = slashCommands.find((cmd) => cmd.name === 'daily');
      expect(dailyCmd).toBeDefined();
      expect(dailyCmd?.description).toBe('Điểm danh nhận DNE Coins hằng ngày và duy trì chuỗi streak');
    });

    it('registers /rep command with user and reason options', () => {
      const repCmd = slashCommands.find((cmd) => cmd.name === 'rep');
      expect(repCmd).toBeDefined();
      expect(repCmd?.description).toBe('Tặng điểm tín nhiệm / yêu mến cho thành viên khác (tối đa 3 lần/ngày)');
      
      const userOpt = repCmd?.options?.find((opt: any) => opt.name === 'user');
      expect(userOpt).toBeDefined();
      expect(userOpt?.description).toBe('Thành viên bạn muốn +rep');
      expect(userOpt?.required).toBe(true);

      const reasonOpt = repCmd?.options?.find((opt: any) => opt.name === 'reason');
      expect(reasonOpt).toBeDefined();
      expect(reasonOpt?.description).toBe('Lời khen hoặc lý do (tùy chọn)');
      expect((reasonOpt as any)?.max_length).toBe(500);
    });

    it('registers /gacha command with spin subcommand', () => {
      const gachaCmd = slashCommands.find((cmd) => cmd.name === 'gacha');
      expect(gachaCmd).toBeDefined();
      expect(gachaCmd?.description).toBe('Vòng quay may mắn nhận DNE Coins, XP và vật phẩm');

      const spinSub = gachaCmd?.options?.find((opt: any) => opt.name === 'spin');
      expect(spinSub).toBeDefined();
      expect(spinSub?.description).toBe('Quay gacha (1 lượt miễn phí mỗi ngày, sau đó 200 DNE Coins)');
    });
  });

  describe('commands/index.ts exports', () => {
    it('re-exports handleDailyCommand, handleRepCommand, and handleGachaCommand', () => {
      expect(commandsIndex).toHaveProperty('handleDailyCommand');
      expect(typeof (commandsIndex as any).handleDailyCommand).toBe('function');

      expect(commandsIndex).toHaveProperty('handleRepCommand');
      expect(typeof (commandsIndex as any).handleRepCommand).toBe('function');

      expect(commandsIndex).toHaveProperty('handleGachaCommand');
      expect(typeof (commandsIndex as any).handleGachaCommand).toBe('function');
    });
  });

  describe('onInteractionCreate routing', () => {
    it('routes /daily command to handleDailyCommand', async () => {
      const interaction = createMockChatInputInteraction('daily');
      await onInteractionCreate(interaction as any);
      expect(handleDailyCommand).toHaveBeenCalledTimes(1);
      expect(handleDailyCommand).toHaveBeenCalledWith(interaction);
    });

    it('routes /rep command to handleRepCommand', async () => {
      const interaction = createMockChatInputInteraction('rep');
      await onInteractionCreate(interaction as any);
      expect(handleRepCommand).toHaveBeenCalledTimes(1);
      expect(handleRepCommand).toHaveBeenCalledWith(interaction);
    });

    it('routes /gacha command to handleGachaCommand', async () => {
      const interaction = createMockChatInputInteraction('gacha');
      await onInteractionCreate(interaction as any);
      expect(handleGachaCommand).toHaveBeenCalledTimes(1);
      expect(handleGachaCommand).toHaveBeenCalledWith(interaction);
    });
  });

  describe('/help command integration', () => {
    it('includes /daily, /rep, and /gacha in /help output', async () => {
      const interaction = createMockChatInputInteraction('help');
      await handleHelpCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledTimes(1);
      const callArgs = (interaction.reply as any).mock.calls[0][0];
      expect(callArgs.content).toContain('/daily — Điểm danh nhận DNE Coins hằng ngày và duy trì chuỗi streak');
      expect(callArgs.content).toContain('/rep — Tặng điểm tín nhiệm / yêu mến cho thành viên khác (tối đa 3 lần/ngày)');
      expect(callArgs.content).toContain('/gacha — Vòng quay may mắn nhận DNE Coins, XP và vật phẩm');
    });
  });
});
