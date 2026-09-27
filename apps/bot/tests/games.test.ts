import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  validateWordChain,
  WordChainGame,
  channelChainState
} from '../src/services/game/WordChainGame';
import {
  calculateBauCuaPayout,
  BauCuaGame,
  BAU_CUA_ITEMS,
  type BauCuaItem
} from '../src/services/game/BauCuaGame';
import { handleRandomWheelCommand } from '../src/commands/random';
import { handleGameCommand } from '../src/commands/game';
import { WheelSessionModel } from '../src/models/WheelSession';
import { UserStatModel } from '../src/models/UserStat';
import type { ChatInputCommandInteraction } from 'discord.js';

describe('Mini-Games Logic', () => {
  describe('Word Chain (Nối Từ)', () => {
    it('validates word chain: word must start with previous word ending', () => {
      expect(validateWordChain('hoa hồng', 'hồng hào')).toBe(true);
      expect(validateWordChain('hoa hồng', 'bông hoa')).toBe(false);
    });

    it('handles case-insensitivity, trim and multi-word phrases', () => {
      expect(validateWordChain('Hoa Hồng', 'HỒNG HÀO')).toBe(true);
      expect(validateWordChain('   hoa sen   ', 'sen đá')).toBe(true);
      expect(validateWordChain('hoa hồng đỏ', 'đỏ rực')).toBe(true);
      expect(validateWordChain('con mèo tam thể', 'thể thao')).toBe(true);
    });

    it('rejects single-token or invalid inputs', () => {
      expect(validateWordChain('hồng', 'hồng hào')).toBe(false);
      expect(validateWordChain('hoa hồng', 'hồng')).toBe(false);
      expect(validateWordChain('', '')).toBe(false);
    });

    it('WordChainGame manages channel state and processes words sequentially', () => {
      WordChainGame.reset('chan-1');

      // First word starts the chain
      const res1 = WordChainGame.processWord('chan-1', 'hoa hồng');
      expect(res1.success).toBe(true);
      expect(res1.message).toContain('hoa hồng');

      // Valid continuation
      const res2 = WordChainGame.processWord('chan-1', 'hồng hào');
      expect(res2.success).toBe(true);
      expect(res2.message).toContain('hào');

      // Invalid continuation
      const res3 = WordChainGame.processWord('chan-1', 'xanh biếc');
      expect(res3.success).toBe(false);
      expect(res3.message).toContain('hào');

      // Check submitWord alias
      const res4 = WordChainGame.submitWord('chan-1', 'hào hiệp');
      expect(res4.success).toBe(true);
    });

    it('isolates state across different channels and allows reset', () => {
      WordChainGame.reset();
      WordChainGame.processWord('chan-a', 'long lanh');
      WordChainGame.processWord('chan-b', 'mặt trời');

      expect(WordChainGame.getLastWord('chan-a')).toBe('long lanh');
      expect(WordChainGame.getLastWord('chan-b')).toBe('mặt trời');

      WordChainGame.reset('chan-a');
      expect(WordChainGame.getLastWord('chan-a')).toBeUndefined();
      expect(WordChainGame.getLastWord('chan-b')).toBe('mặt trời');
    });
  });

  describe('Bầu Cua Tôm Cá', () => {
    it('calculates Bầu Cua payout based on matched dice', () => {
      const rolled: BauCuaItem[] = ['BẦU', 'CUA', 'BẦU'];
      // Bet 100 on BẦU => 2 matches => returns 100 (original) + 200 (profit) = 300
      const payoutBau = calculateBauCuaPayout('BẦU', 100, rolled);
      expect(payoutBau).toBe(300);

      // Bet 100 on GÀ => 0 matches => 0
      const payoutGa = calculateBauCuaPayout('GÀ', 100, rolled);
      expect(payoutGa).toBe(0);

      // Bet 50 on CUA => 1 match => returns 50 (original) + 50 (profit) = 100
      const payoutCua = calculateBauCuaPayout('CUA', 50, rolled);
      expect(payoutCua).toBe(100);

      // Bet 100 on TÔM with 3 matches => returns 100 + 300 = 400
      const payoutTriple = calculateBauCuaPayout('TÔM', 100, ['TÔM', 'TÔM', 'TÔM']);
      expect(payoutTriple).toBe(400);
    });

    it('BauCuaGame rolls exactly 3 valid dice items', () => {
      const rolled = BauCuaGame.rollDice();
      expect(rolled).toHaveLength(3);
      for (const die of rolled) {
        expect(BAU_CUA_ITEMS).toContain(die);
      }

      // Check roll alias
      const rolledAlias = BauCuaGame.roll();
      expect(rolledAlias).toHaveLength(3);
      for (const die of rolledAlias) {
        expect(BAU_CUA_ITEMS).toContain(die);
      }
    });
  });

  describe('Slash Commands', () => {
    beforeEach(() => {
      vi.restoreAllMocks();
    });

    it('/random wheel validates minimum item count (>= 2)', async () => {
      const replyMock = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        options: {
          getString: vi.fn().mockReturnValue('Một con vịt')
        },
        reply: replyMock
      } as unknown as ChatInputCommandInteraction;

      await handleRandomWheelCommand(interaction);
      expect(replyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('ít nhất 2 mục'),
          ephemeral: true
        })
      );
    });

    it('/random wheel creates WheelSession and responds with 3D link and quick spin button', async () => {
      const replyMock = vi.fn().mockResolvedValue(undefined);
      const createSpy = vi.spyOn(WheelSessionModel, 'create').mockResolvedValue({} as any);

      const interaction = {
        guildId: 'guild-123',
        user: { username: 'testuser' },
        options: {
          getString: vi.fn().mockReturnValue('Option A, Option B, Option C')
        },
        reply: replyMock
      } as unknown as ChatInputCommandInteraction;

      await handleRandomWheelCommand(interaction);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-123',
          createdBy: 'testuser',
          items: expect.arrayContaining([
            expect.objectContaining({ id: 'item-0', label: 'Option A' }),
            expect.objectContaining({ id: 'item-1', label: 'Option B' }),
            expect.objectContaining({ id: 'item-2', label: 'Option C' })
          ])
        })
      );

      expect(replyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: expect.any(Array)
        })
      );

      const replyArgs = replyMock.mock.calls[0][0];
      const components = replyArgs.components[0].components;
      expect(components).toHaveLength(2);
      expect(components[0].data.label).toContain('Mở Vòng Quay 3D trên Web');
      expect(components[1].data.label).toContain('Quay Nhanh tại Discord');
    });

    it('/game wordchain delegates to WordChainGame', async () => {
      WordChainGame.reset('chan-game-1');
      const replyMock = vi.fn().mockResolvedValue(undefined);
      const interaction = {
        channelId: 'chan-game-1',
        options: {
          getSubcommand: vi.fn().mockReturnValue('wordchain'),
          getString: vi.fn().mockReturnValue('cây đa')
        },
        reply: replyMock
      } as unknown as ChatInputCommandInteraction;

      await handleGameCommand(interaction);
      expect(replyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('cây đa')
        })
      );
    });

    it('/game baucua rejects when bet is invalid or user balance is insufficient', async () => {
      const replyMock = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        dneCoins: 50
      } as any);

      const interaction = {
        guildId: 'guild-123',
        user: { id: 'user-1', username: 'poor_user' },
        options: {
          getSubcommand: vi.fn().mockReturnValue('baucua'),
          getString: vi.fn().mockReturnValue('BẦU'),
          getInteger: vi.fn().mockReturnValue(100)
        },
        reply: replyMock
      } as unknown as ChatInputCommandInteraction;

      await handleGameCommand(interaction);
      expect(replyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Số dư DNE Coins của bạn không đủ'),
          ephemeral: true
        })
      );
    });

    it('/game baucua plays game, updates user coins and returns result embed', async () => {
      const replyMock = vi.fn().mockResolvedValue(undefined);
      vi.spyOn(UserStatModel, 'findOne').mockResolvedValue({
        dneCoins: 500
      } as any);
      const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);
      vi.spyOn(BauCuaGame, 'rollDice').mockReturnValue(['BẦU', 'CUA', 'BẦU']);

      const interaction = {
        guildId: 'guild-123',
        user: { id: 'user-1', username: 'lucky_user' },
        options: {
          getSubcommand: vi.fn().mockReturnValue('baucua'),
          getString: vi.fn().mockReturnValue('BẦU'),
          getInteger: vi.fn().mockReturnValue(100)
        },
        reply: replyMock
      } as unknown as ChatInputCommandInteraction;

      await handleGameCommand(interaction);

      // 2 matches: payout = 300, net change = 200
      expect(updateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-123', userId: 'user-1' },
        {
          $inc: { dneCoins: 200 },
          $setOnInsert: { username: 'lucky_user' }
        },
        { upsert: true }
      );

      expect(replyMock).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });
  });
});
