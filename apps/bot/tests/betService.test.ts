import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import { UserStatModel } from '../src/models/UserStat';
import { BetModel } from '../src/models/Bet';
import { BetService } from '../src/services/betting/BetService';
import {
  handleBetButton,
  handleBetCommand,
  parseDuration
} from '../src/commands/bet';

describe('BetService (1v1 P2P Challenge & Community Pool Wagers)', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('P2P 1v1 Challenge', () => {
    it('creates P2P challenge and deducts creator coins atomically via { dneCoins: { $gte: amount } }', async () => {
      const findOneAndUpdateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'creator-1',
        dneCoins: 800
      } as never);

      const createSpy = vi.spyOn(BetModel, 'create').mockImplementation(async (data: any) => ({
        ...data,
        save: vi.fn().mockResolvedValue(data)
      }) as never);

      const bet = await BetService.createP2PChallenge({
        guildId: 'guild-1',
        creatorId: 'creator-1',
        creatorUsername: 'Alice',
        opponentId: 'opponent-2',
        opponentUsername: 'Bob',
        amount: 200,
        title: 'Kèo solo Yasuo 1v1 Mid',
        creatorPick: 'Alice win'
      });

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'creator-1', dneCoins: { $gte: 200 } },
        { $inc: { dneCoins: -200 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { new: true }
      );

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-1',
          creatorId: 'creator-1',
          opponentId: 'opponent-2',
          kind: 'p2p',
          status: 'open',
          totalPool: 200,
          title: 'Kèo solo Yasuo 1v1 Mid'
        })
      );

      expect(bet.kind).toBe('p2p');
      expect(bet.status).toBe('open');
      expect(bet.totalPool).toBe(200);
      expect(bet.wagers).toHaveLength(1);
      expect(bet.wagers[0].userId).toBe('creator-1');
      expect(bet.wagers[0].amount).toBe(200);
    });

    it('fails when creator has insufficient coins to create challenge', async () => {
      vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue(null as never);

      await expect(
        BetService.createP2PChallenge({
          guildId: 'guild-1',
          creatorId: 'creator-1',
          creatorUsername: 'Alice',
          opponentId: 'opponent-2',
          amount: 500,
          title: 'Solo Yasuo',
          creatorPick: 'Alice'
        })
      ).rejects.toThrow('Bạn không đủ DNE Coins để đặt cược (cần 500 xu)!');
    });

    it('rejects challenging oneself', async () => {
      await expect(
        BetService.createP2PChallenge({
          guildId: 'guild-1',
          creatorId: 'user-1',
          creatorUsername: 'Alice',
          opponentId: 'user-1',
          amount: 100,
          title: 'Tự sướng',
          creatorPick: 'Me'
        })
      ).rejects.toThrow('Bạn không thể tự thách đấu chính mình!');
    });

    it('accepts P2P challenge, deducts opponent coins, and marks bet active with 2x pool', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        creatorUsername: 'Alice',
        opponentId: 'opponent-2',
        opponentUsername: 'Bob',
        title: 'Kèo solo',
        options: ['Alice win', 'Bob win'],
        wagers: [
          { userId: 'creator-1', username: 'Alice', option: 'Alice win', amount: 150, createdAt: new Date() }
        ],
        status: 'open',
        totalPool: 150,
        expiresAt: new Date(Date.now() + 86400000)
      };

      const updatedMockBet: any = {
        ...mockBet,
        status: 'active',
        totalPool: 300,
        wagers: [
          ...mockBet.wagers,
          { userId: 'opponent-2', username: 'Bob', option: 'Bob win', amount: 150, createdAt: new Date() }
        ]
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      const betUpdateSpy = vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue(updatedMockBet as never);
      const findOneAndUpdateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'opponent-2',
        dneCoins: 850
      } as never);

      const acceptedBet = await BetService.acceptP2PChallenge({
        betId: 'bet-123',
        opponentId: 'opponent-2',
        opponentUsername: 'Bob'
      });

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'opponent-2', dneCoins: { $gte: 150 } },
        { $inc: { dneCoins: -150 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { new: true }
      );

      expect(betUpdateSpy).toHaveBeenCalledWith(
        {
          betId: 'bet-123',
          status: 'open',
          $or: [{ opponentId: null }, { opponentId: 'opponent-2' }]
        },
        expect.objectContaining({
          $set: { status: 'active', opponentId: 'opponent-2', opponentUsername: 'Bob' },
          $inc: { totalPool: 150 }
        }),
        { new: true }
      );

      expect(acceptedBet.status).toBe('active');
      expect(acceptedBet.totalPool).toBe(300);
      expect(acceptedBet.wagers).toHaveLength(2);
      expect(acceptedBet.wagers[1].userId).toBe('opponent-2');
      expect(acceptedBet.wagers[1].amount).toBe(150);
    });

    it('refunds opponent immediately if challenge is accepted concurrently or closed', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        opponentId: 'opponent-2',
        wagers: [{ userId: 'creator-1', amount: 150, option: 'Alice win' }],
        status: 'open',
        options: ['Alice win', 'Bob win'],
        totalPool: 150,
        expiresAt: new Date(Date.now() + 86400000)
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      const userStatUpdateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate')
        .mockResolvedValueOnce({ dneCoins: 850 } as never) // deduction
        .mockResolvedValueOnce({ dneCoins: 1000 } as never); // refund

      vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue(null as never);

      await expect(
        BetService.acceptP2PChallenge({
          betId: 'bet-123',
          opponentId: 'opponent-2',
          opponentUsername: 'Bob'
        })
      ).rejects.toThrow('Kèo cược đã được người khác chấp nhận hoặc không còn mở!');

      expect(userStatUpdateSpy).toHaveBeenLastCalledWith(
        { guildId: 'guild-1', userId: 'opponent-2' },
        { $inc: { dneCoins: 150 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { upsert: true }
      );
    });

    it('fails accepting challenge when opponent has insufficient coins', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        opponentId: 'opponent-2',
        wagers: [{ userId: 'creator-1', amount: 300, option: 'pick', createdAt: new Date() }],
        status: 'open',
        expiresAt: new Date(Date.now() + 86400000)
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue(null as never);

      await expect(
        BetService.acceptP2PChallenge({
          betId: 'bet-123',
          opponentId: 'opponent-2',
          opponentUsername: 'Bob'
        })
      ).rejects.toThrow('Bạn không đủ DNE Coins để đặt cược (cần 300 xu)!');
    });

    it('fails accepting challenge if caller is not the challenged opponent', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        opponentId: 'opponent-2',
        wagers: [{ userId: 'creator-1', amount: 100, option: 'pick', createdAt: new Date() }],
        status: 'open',
        expiresAt: new Date(Date.now() + 86400000)
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);

      await expect(
        BetService.acceptP2PChallenge({
          betId: 'bet-123',
          opponentId: 'intruder-3',
          opponentUsername: 'Charlie'
        })
      ).rejects.toThrow('Bạn không phải là người được thách đấu trong kèo này!');
    });

    it('rejects/cancels P2P challenge and refunds creator escrow', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        opponentId: 'opponent-2',
        wagers: [{ userId: 'creator-1', amount: 250, option: 'pick', createdAt: new Date() }],
        status: 'open',
        totalPool: 250,
        expiresAt: new Date(Date.now() + 86400000)
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue({
        ...mockBet,
        status: 'cancelled'
      } as never);
      const refundSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as never);

      const result = await BetService.rejectOrCancelP2P({
        betId: 'bet-123',
        userId: 'opponent-2'
      });

      expect(refundSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'creator-1' },
        { $inc: { dneCoins: 250 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { upsert: true }
      );

      expect(result.status).toBe('cancelled');
    });

    it('fails reject/cancel if challenge was already resolved or cancelled concurrently', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        opponentId: 'opponent-2',
        status: 'open'
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue(null as never);

      await expect(
        BetService.rejectOrCancelP2P({
          betId: 'bet-123',
          userId: 'creator-1'
        })
      ).rejects.toThrow('Kèo cược đã được chấp nhận, đã kết toán hoặc đã bị hủy!');
    });

    it('fails reject/cancel if caller is neither creator nor opponent', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        opponentId: 'opponent-2',
        status: 'open'
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);

      await expect(
        BetService.rejectOrCancelP2P({
          betId: 'bet-123',
          userId: 'intruder-3'
        })
      ).rejects.toThrow('Bạn không có quyền hủy hoặc từ chối kèo cược này!');
    });

    it('resolves P2P challenge and awards pot to winner', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        opponentId: 'opponent-2',
        totalPool: 400,
        options: ['Alice win', 'Bob win'],
        wagers: [
          { userId: 'creator-1', username: 'Alice', option: 'Alice win', amount: 200, createdAt: new Date() },
          { userId: 'opponent-2', username: 'Bob', option: 'Bob win', amount: 200, createdAt: new Date() }
        ],
        status: 'active'
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue({
        ...mockBet,
        status: 'resolved',
        winnerUserId: 'opponent-2',
        winnerOption: 'Bob win'
      } as never);
      const awardSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as never);

      const res = await BetService.resolveP2PChallenge({
        betId: 'bet-123',
        callerId: 'creator-1',
        isGuildAdmin: false,
        winnerUserId: 'opponent-2'
      });

      expect(awardSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'opponent-2' },
        { $inc: { dneCoins: 400 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { upsert: true }
      );

      expect(res.winnerId).toBe('opponent-2');
      expect(res.payout).toBe(400);
      expect(res.bet.status).toBe('resolved');
      expect(res.bet.winnerUserId).toBe('opponent-2');
    });

    it('fails resolving P2P challenge if already resolved concurrently', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        opponentId: 'opponent-2',
        status: 'active',
        totalPool: 400,
        options: ['Alice win', 'Bob win'],
        wagers: [
          { userId: 'creator-1', username: 'Alice', option: 'Alice win', amount: 200, createdAt: new Date() },
          { userId: 'opponent-2', username: 'Bob', option: 'Bob win', amount: 200, createdAt: new Date() }
        ]
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue(null as never);
      const awardSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');

      await expect(
        BetService.resolveP2PChallenge({
          betId: 'bet-123',
          callerId: 'creator-1',
          isGuildAdmin: false,
          winnerUserId: 'opponent-2'
        })
      ).rejects.toThrow('Kèo cược đã được kết toán hoặc không còn hoạt động!');

      expect(awardSpy).not.toHaveBeenCalled();
    });

    it('rejects unauthorized non-admin user trying to resolve P2P challenge', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        opponentId: 'opponent-2',
        status: 'active'
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);

      await expect(
        BetService.resolveP2PChallenge({
          betId: 'bet-123',
          callerId: 'stranger-999',
          isGuildAdmin: false,
          winnerUserId: 'creator-1'
        })
      ).rejects.toThrow('Bạn không có quyền phân định kết quả kèo cược này!');
    });

    it('allows guild admin to resolve P2P challenge even if not creator', async () => {
      const mockBet: any = {
        betId: 'bet-123',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        opponentId: 'opponent-2',
        totalPool: 600,
        options: ['Alice', 'Bob'],
        wagers: [
          { userId: 'creator-1', username: 'Alice', option: 'Alice', amount: 300, createdAt: new Date() },
          { userId: 'opponent-2', username: 'Bob', option: 'Bob', amount: 300, createdAt: new Date() }
        ],
        status: 'active'
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue({
        ...mockBet,
        status: 'resolved',
        winnerUserId: 'creator-1',
        winnerOption: 'Alice'
      } as never);
      vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as never);

      const res = await BetService.resolveP2PChallenge({
        betId: 'bet-123',
        callerId: 'admin-mod-1',
        isGuildAdmin: true,
        winnerUserId: 'creator-1'
      });

      expect(res.winnerId).toBe('creator-1');
      expect(res.payout).toBe(600);
      expect(res.bet.status).toBe('resolved');
    });
  });

  describe('Community Pool Betting', () => {
    it('creates community pool with multiple options', async () => {
      const createSpy = vi.spyOn(BetModel, 'create').mockImplementation(async (data: any) => ({
        ...data,
        save: vi.fn().mockResolvedValue(data)
      }) as never);

      const bet = await BetService.createCommunityPool({
        guildId: 'guild-1',
        creatorId: 'creator-1',
        creatorUsername: 'Admin',
        title: 'Ai vô địch CKTG 2026?',
        options: ['T1', 'GenG', 'BLG'],
        durationMs: 3600000
      });

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-1',
          creatorId: 'creator-1',
          kind: 'pool',
          status: 'open',
          totalPool: 0,
          options: ['T1', 'GenG', 'BLG']
        })
      );
      expect(bet.kind).toBe('pool');
      expect(bet.options).toEqual(['T1', 'GenG', 'BLG']);
    });

    it('rejects creating community pool with fewer than 2 unique options', async () => {
      await expect(
        BetService.createCommunityPool({
          guildId: 'guild-1',
          creatorId: 'creator-1',
          creatorUsername: 'Admin',
          title: 'Single choice',
          options: ['T1', 'T1'],
          durationMs: 3600000
        })
      ).rejects.toThrow('Kèo cộng đồng cần ít nhất 2 lựa chọn khác nhau!');
    });

    it('joins community pool and atomically deducts coins and aggregates totalPool', async () => {
      const mockBet: any = {
        betId: 'pool-456',
        guildId: 'guild-1',
        kind: 'pool',
        title: 'Ai vô địch CKTG 2026?',
        options: ['T1', 'GenG', 'BLG'],
        wagers: [],
        totalPool: 0,
        status: 'open',
        expiresAt: new Date(Date.now() + 3600000)
      };

      const updatedMockBet: any = {
        ...mockBet,
        totalPool: 300,
        wagers: [
          {
            userId: 'user-bettor-1',
            username: 'FakerFan',
            option: 'T1',
            amount: 300,
            createdAt: expect.any(Date)
          }
        ]
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      const betUpdateSpy = vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue(updatedMockBet as never);
      const findOneAndUpdateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({
        guildId: 'guild-1',
        userId: 'user-bettor-1',
        dneCoins: 1200
      } as never);

      const updatedBet = await BetService.joinCommunityPool({
        betId: 'pool-456',
        userId: 'user-bettor-1',
        username: 'FakerFan',
        option: 'T1',
        amount: 300
      });

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'user-bettor-1', dneCoins: { $gte: 300 } },
        { $inc: { dneCoins: -300 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { new: true }
      );

      expect(betUpdateSpy).toHaveBeenCalledWith(
        { betId: 'pool-456', status: 'open', expiresAt: { $gt: expect.any(Date) } },
        expect.objectContaining({
          $push: { wagers: expect.any(Object) },
          $inc: { totalPool: 300 }
        }),
        { new: true }
      );

      expect(updatedBet.totalPool).toBe(300);
      expect(updatedBet.wagers).toHaveLength(1);
      expect(updatedBet.wagers[0]).toEqual(
        expect.objectContaining({
          userId: 'user-bettor-1',
          username: 'FakerFan',
          option: 'T1',
          amount: 300
        })
      );
    });

    it('refunds user immediately when joining community pool that closed/expired concurrently', async () => {
      const mockBet: any = {
        betId: 'pool-456',
        guildId: 'guild-1',
        kind: 'pool',
        options: ['T1', 'GenG'],
        wagers: [],
        totalPool: 0,
        status: 'open',
        expiresAt: new Date(Date.now() + 3600000)
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      const userStatSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate')
        .mockResolvedValueOnce({ dneCoins: 500 } as never) // deduction
        .mockResolvedValueOnce({ dneCoins: 800 } as never); // refund
      vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue(null as never);

      await expect(
        BetService.joinCommunityPool({
          betId: 'pool-456',
          userId: 'user-bettor-1',
          username: 'FakerFan',
          option: 'T1',
          amount: 300
        })
      ).rejects.toThrow('Kèo cược đã hết hạn hoặc không còn mở!');

      expect(userStatSpy).toHaveBeenLastCalledWith(
        { guildId: 'guild-1', userId: 'user-bettor-1' },
        { $inc: { dneCoins: 300 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { upsert: true }
      );
    });

    it('fails joining pool when user has insufficient coins', async () => {
      const mockBet: any = {
        betId: 'pool-456',
        guildId: 'guild-1',
        kind: 'pool',
        options: ['T1', 'GenG'],
        wagers: [],
        totalPool: 0,
        status: 'open',
        expiresAt: new Date(Date.now() + 3600000)
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue(null as never);

      await expect(
        BetService.joinCommunityPool({
          betId: 'pool-456',
          userId: 'user-poor',
          username: 'PoorUser',
          option: 'T1',
          amount: 1000
        })
      ).rejects.toThrow('Bạn không đủ DNE Coins để đặt cược (cần 1000 xu)!');
    });

    it('fails joining pool with an invalid option', async () => {
      const mockBet: any = {
        betId: 'pool-456',
        guildId: 'guild-1',
        kind: 'pool',
        options: ['T1', 'GenG'],
        wagers: [],
        totalPool: 0,
        status: 'open',
        expiresAt: new Date(Date.now() + 3600000)
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);

      await expect(
        BetService.joinCommunityPool({
          betId: 'pool-456',
          userId: 'user-1',
          username: 'User1',
          option: 'InvalidOption',
          amount: 100
        })
      ).rejects.toThrow('Lựa chọn không hợp lệ!');
    });

    it('resolves pool and distributes proportional pari-mutuel payout to all winners', async () => {
      // Pool total: 1000 coins
      // Option A total: 400 coins (User 1: 100, User 2: 300)
      // Option B total: 600 coins (User 3: 600)
      // If Option A wins:
      // User 1 gets Math.floor((100 / 400) * 1000) = 250 coins
      // User 2 gets Math.floor((300 / 400) * 1000) = 750 coins
      const mockBet: any = {
        betId: 'pool-win-1',
        guildId: 'guild-1',
        kind: 'pool',
        creatorId: 'creator-admin',
        title: 'Ai thắng trận chung kết?',
        options: ['A', 'B'],
        totalPool: 1000,
        status: 'open',
        wagers: [
          { userId: 'u1', username: 'User1', option: 'A', amount: 100, createdAt: new Date() },
          { userId: 'u2', username: 'User2', option: 'A', amount: 300, createdAt: new Date() },
          { userId: 'u3', username: 'User3', option: 'B', amount: 600, createdAt: new Date() }
        ]
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue({
        ...mockBet,
        status: 'resolved',
        winnerOption: 'A'
      } as never);
      const findOneAndUpdateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as never);

      const result = await BetService.resolveCommunityPool({
        betId: 'pool-win-1',
        callerId: 'creator-admin',
        isGuildAdmin: false,
        winningOption: 'A'
      });

      expect(result.winningOption).toBe('A');
      expect(result.totalWinners).toBe(2);
      expect(result.totalPayout).toBe(1000);
      expect(result.refundsGiven).toBe(false);

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'u1' },
        { $inc: { dneCoins: 250 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { upsert: true }
      );

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'u2' },
        { $inc: { dneCoins: 750 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { upsert: true }
      );

      expect(result.bet.status).toBe('resolved');
      expect(result.bet.winnerOption).toBe('A');
    });

    it('zero-winner pool refunds all players when nobody chose the winning option', async () => {
      // Pool total: 500
      // User 1 bet 200 on A, User 2 bet 300 on B
      // Winning option is C
      const mockBet: any = {
        betId: 'pool-refund-1',
        guildId: 'guild-1',
        kind: 'pool',
        creatorId: 'creator-admin',
        title: 'Ai thắng trận?',
        options: ['A', 'B', 'C'],
        totalPool: 500,
        status: 'open',
        wagers: [
          { userId: 'u1', username: 'User1', option: 'A', amount: 200, createdAt: new Date() },
          { userId: 'u2', username: 'User2', option: 'B', amount: 300, createdAt: new Date() }
        ]
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue({
        ...mockBet,
        status: 'resolved',
        winnerOption: 'C'
      } as never);
      const refundSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as never);

      const result = await BetService.resolveCommunityPool({
        betId: 'pool-refund-1',
        callerId: 'creator-admin',
        isGuildAdmin: false,
        winningOption: 'C'
      });

      expect(result.refundsGiven).toBe(true);
      expect(result.totalWinners).toBe(0);

      expect(refundSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'u1' },
        { $inc: { dneCoins: 200 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { upsert: true }
      );

      expect(refundSpy).toHaveBeenCalledWith(
        { guildId: 'guild-1', userId: 'u2' },
        { $inc: { dneCoins: 300 }, $set: expect.objectContaining({ updatedAt: expect.any(Date) }) },
        { upsert: true }
      );
    });

    it('fails resolving community pool if already resolved concurrently', async () => {
      const mockBet: any = {
        betId: 'pool-race-1',
        guildId: 'guild-1',
        kind: 'pool',
        creatorId: 'creator-admin',
        options: ['A', 'B'],
        status: 'open',
        wagers: []
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);
      vi.spyOn(BetModel, 'findOneAndUpdate').mockResolvedValue(null as never);
      const userStatSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');

      await expect(
        BetService.resolveCommunityPool({
          betId: 'pool-race-1',
          callerId: 'creator-admin',
          isGuildAdmin: false,
          winningOption: 'A'
        })
      ).rejects.toThrow('Kèo cược đã được kết toán hoặc đã bị hủy!');

      expect(userStatSpy).not.toHaveBeenCalled();
    });

    it('rejects unauthorized resolution of community pool by non-admin stranger', async () => {
      const mockBet: any = {
        betId: 'pool-sec-1',
        guildId: 'guild-1',
        kind: 'pool',
        creatorId: 'creator-admin',
        options: ['A', 'B'],
        status: 'open'
      };

      vi.spyOn(BetModel, 'findOne').mockResolvedValue(mockBet as never);

      await expect(
        BetService.resolveCommunityPool({
          betId: 'pool-sec-1',
          callerId: 'random-user',
          isGuildAdmin: false,
          winningOption: 'A'
        })
      ).rejects.toThrow('Bạn không có quyền phân định kết quả kèo cược này!');
    });
  });

  describe('Duration Parsing Utility', () => {
    it('parses duration strings correctly into milliseconds', () => {
      expect(parseDuration('30m')).toBe(30 * 60 * 1000);
      expect(parseDuration('1h')).toBe(60 * 60 * 1000);
      expect(parseDuration('2h')).toBe(2 * 60 * 60 * 1000);
      expect(parseDuration('1d')).toBe(24 * 60 * 60 * 1000);
      expect(parseDuration('120')).toBe(120 * 60 * 1000); // defaults to minutes
    });

    it('throws error for invalid duration formats', () => {
      expect(() => parseDuration('invalid')).toThrow();
      expect(() => parseDuration('0m')).toThrow();
    });
  });

  describe('Discord Command & Button Interaction Handlers', () => {
    function mockInteraction(subcommand: string, optionsMap: Record<string, any> = {}, isGuildAdmin = false) {
      return {
        guildId: 'guild-1',
        user: { id: 'caller-1', username: 'TestCaller' },
        memberPermissions: {
          has: vi.fn().mockImplementation((perm: any) => isGuildAdmin)
        },
        options: {
          getSubcommand: vi.fn().mockReturnValue(subcommand),
          getUser: vi.fn().mockImplementation((name: string) => optionsMap[name] || null),
          getInteger: vi.fn().mockImplementation((name: string) => optionsMap[name] ?? null),
          getString: vi.fn().mockImplementation((name: string) => optionsMap[name] ?? null)
        },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined)
      } as unknown as ChatInputCommandInteraction;
    }

    it('handles /bet challenge successfully', async () => {
      const interaction = mockInteraction('challenge', {
        user: { id: 'opponent-2', username: 'TargetOpponent' },
        amount: 100,
        title: 'Kèo 1v1',
        pick: 'Ta thắng'
      });

      vi.spyOn(BetService, 'createP2PChallenge').mockResolvedValue({
        betId: 'bet-xyz',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'caller-1',
        creatorUsername: 'TestCaller',
        opponentId: 'opponent-2',
        opponentUsername: 'TargetOpponent',
        title: 'Kèo 1v1',
        options: ['Ta thắng', 'TargetOpponent'],
        wagers: [{ userId: 'caller-1', username: 'TestCaller', option: 'Ta thắng', amount: 100, createdAt: new Date() }],
        status: 'open',
        totalPool: 100,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date()
      });

      await handleBetCommand(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array),
          components: expect.any(Array)
        })
      );
    });

    it('handles /bet accept successfully', async () => {
      const interaction = mockInteraction('accept', { id: 'bet-xyz' });

      vi.spyOn(BetService, 'acceptP2PChallenge').mockResolvedValue({
        betId: 'bet-xyz',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        creatorUsername: 'CreatorUser',
        opponentId: 'caller-1',
        opponentUsername: 'TestCaller',
        title: 'Kèo 1v1',
        options: ['Pick 1', 'Pick 2'],
        wagers: [
          { userId: 'creator-1', username: 'CreatorUser', option: 'Pick 1', amount: 100, createdAt: new Date() },
          { userId: 'caller-1', username: 'TestCaller', option: 'Pick 2', amount: 100, createdAt: new Date() }
        ],
        status: 'active',
        totalPool: 200,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date()
      });

      await handleBetCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.any(Array)
        })
      );
    });

    it('handles button accept interaction: bet:p2p:accept:<id>', async () => {
      const btnInteraction = {
        guildId: 'guild-1',
        customId: 'bet:p2p:accept:bet-xyz',
        user: { id: 'opponent-2', username: 'OpponentUser' },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined)
      } as unknown as ButtonInteraction;

      vi.spyOn(BetService, 'acceptP2PChallenge').mockResolvedValue({
        betId: 'bet-xyz',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        creatorUsername: 'CreatorUser',
        opponentId: 'opponent-2',
        opponentUsername: 'OpponentUser',
        title: 'Kèo 1v1',
        options: ['A', 'B'],
        wagers: [
          { userId: 'creator-1', username: 'CreatorUser', option: 'A', amount: 100, createdAt: new Date() },
          { userId: 'opponent-2', username: 'OpponentUser', option: 'B', amount: 100, createdAt: new Date() }
        ],
        status: 'active',
        totalPool: 200,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date()
      });

      await handleBetButton(btnInteraction);

      expect(btnInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(btnInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Bạn đã chấp nhận kèo thách đấu thành công!')
        })
      );
    });

    it('handles button reject interaction: bet:p2p:reject:<id>', async () => {
      const btnInteraction = {
        guildId: 'guild-1',
        customId: 'bet:p2p:reject:bet-xyz',
        user: { id: 'opponent-2', username: 'OpponentUser' },
        deferReply: vi.fn().mockResolvedValue(undefined),
        editReply: vi.fn().mockResolvedValue(undefined),
        reply: vi.fn().mockResolvedValue(undefined)
      } as unknown as ButtonInteraction;

      vi.spyOn(BetService, 'rejectOrCancelP2P').mockResolvedValue({
        betId: 'bet-xyz',
        guildId: 'guild-1',
        kind: 'p2p',
        creatorId: 'creator-1',
        creatorUsername: 'CreatorUser',
        opponentId: 'opponent-2',
        title: 'Kèo 1v1',
        options: ['A', 'B'],
        wagers: [],
        status: 'cancelled',
        totalPool: 100,
        expiresAt: new Date(Date.now() + 86400000),
        createdAt: new Date()
      });

      await handleBetButton(btnInteraction);

      expect(btnInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(btnInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đã từ chối / hủy kèo cược thành công.')
        })
      );
    });
  });
});
