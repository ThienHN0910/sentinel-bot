import { nanoid } from 'nanoid';
import { IBet, Wager } from '@sentinel/shared';
import { BetModel } from '../../models/Bet';
import { UserStatModel } from '../../models/UserStat';

export class BetService {
  /**
   * Creates a 1v1 P2P Challenge bet with atomic coin escrow deduction from creator.
   */
  public static async createP2PChallenge(params: {
    guildId: string;
    creatorId: string;
    creatorUsername: string;
    opponentId: string;
    opponentUsername?: string;
    amount: number;
    title: string;
    creatorPick: string;
    expiresInMs?: number;
  }): Promise<IBet> {
    const {
      guildId,
      creatorId,
      creatorUsername,
      opponentId,
      opponentUsername,
      amount,
      title,
      creatorPick,
      expiresInMs = 24 * 60 * 60 * 1000
    } = params;

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Số xu cược phải là số nguyên dương lớn hơn 0!');
    }

    if (creatorId === opponentId) {
      throw new Error('Bạn không thể tự thách đấu chính mình!');
    }

    const cleanTitle = title?.trim();
    if (!cleanTitle) {
      throw new Error('Tiêu đề thách đấu không được để trống!');
    }

    const cleanPick = creatorPick?.trim();
    if (!cleanPick) {
      throw new Error('Lựa chọn cược không được để trống!');
    }

    // Atomic escrow deduction from creator
    const now = new Date();
    const updatedCreator = await UserStatModel.findOneAndUpdate(
      { guildId, userId: creatorId, dneCoins: { $gte: amount } },
      { $inc: { dneCoins: -amount }, $set: { updatedAt: now } },
      { new: true }
    );

    if (!updatedCreator) {
      throw new Error(`Bạn không đủ DNE Coins để đặt cược (cần ${amount} xu)!`);
    }

    const betId = nanoid(10);
    const opponentPickLabel = opponentUsername ? `@${opponentUsername}` : 'Đối thủ';
    const expiresAt = new Date(Date.now() + expiresInMs);

    const initialWager: Wager = {
      userId: creatorId,
      username: creatorUsername,
      option: cleanPick,
      amount,
      createdAt: now
    };

    const bet = await BetModel.create({
      betId,
      guildId,
      kind: 'p2p',
      creatorId,
      creatorUsername,
      opponentId,
      opponentUsername,
      title: cleanTitle,
      options: [cleanPick, opponentPickLabel],
      wagers: [initialWager],
      status: 'open',
      totalPool: amount,
      expiresAt,
      createdAt: now
    });

    return bet;
  }

  /**
   * Accepts a 1v1 P2P Challenge with atomic coin escrow deduction from opponent.
   */
  public static async acceptP2PChallenge(params: {
    betId: string;
    opponentId: string;
    opponentUsername: string;
  }): Promise<IBet> {
    const { betId, opponentId, opponentUsername } = params;

    const bet = await BetModel.findOne({ betId });
    if (!bet) {
      throw new Error('Kèo cược không tồn tại!');
    }

    if (bet.kind !== 'p2p') {
      throw new Error('Kèo cược không phải là thách đấu 1v1!');
    }

    if (bet.status !== 'open') {
      throw new Error('Kèo cược không còn ở trạng thái chờ chấp nhận!');
    }

    const now = new Date();
    if (now > bet.expiresAt) {
      throw new Error('Kèo cược đã hết hạn!');
    }

    if (bet.opponentId && bet.opponentId !== opponentId) {
      throw new Error('Bạn không phải là người được thách đấu trong kèo này!');
    }

    if (bet.creatorId === opponentId) {
      throw new Error('Bạn không thể tự chấp nhận thách đấu của chính mình!');
    }

    const creatorWager = bet.wagers.find((w: Wager) => w.userId === bet.creatorId);
    const matchAmount = creatorWager?.amount ?? bet.totalPool;

    // Atomic escrow deduction from opponent
    const updatedOpponent = await UserStatModel.findOneAndUpdate(
      { guildId: bet.guildId, userId: opponentId, dneCoins: { $gte: matchAmount } },
      { $inc: { dneCoins: -matchAmount }, $set: { updatedAt: now } },
      { new: true }
    );

    if (!updatedOpponent) {
      throw new Error(`Bạn không đủ DNE Coins để đặt cược (cần ${matchAmount} xu)!`);
    }

    const opponentOption = bet.options[1] || 'Đối thủ';
    bet.wagers.push({
      userId: opponentId,
      username: opponentUsername,
      option: opponentOption,
      amount: matchAmount,
      createdAt: now
    });

    bet.opponentId = opponentId;
    bet.opponentUsername = opponentUsername;
    bet.totalPool += matchAmount;
    bet.status = 'active';

    await bet.save();
    return bet;
  }

  /**
   * Rejects or cancels an open 1v1 P2P Challenge and refunds creator escrow.
   */
  public static async rejectOrCancelP2P(params: {
    betId: string;
    userId: string;
  }): Promise<IBet> {
    const { betId, userId } = params;

    const bet = await BetModel.findOne({ betId });
    if (!bet) {
      throw new Error('Kèo cược không tồn tại!');
    }

    if (bet.kind !== 'p2p') {
      throw new Error('Kèo cược không phải là thách đấu 1v1!');
    }

    if (bet.status !== 'open') {
      throw new Error('Chỉ có thể hủy hoặc từ chối kèo đang mở!');
    }

    if (userId !== bet.creatorId && userId !== bet.opponentId) {
      throw new Error('Bạn không có quyền hủy hoặc từ chối kèo cược này!');
    }

    // Refund creator escrow
    const creatorWager = bet.wagers.find((w: Wager) => w.userId === bet.creatorId);
    const refundAmount = creatorWager?.amount ?? bet.totalPool;

    if (refundAmount > 0) {
      await UserStatModel.findOneAndUpdate(
        { guildId: bet.guildId, userId: bet.creatorId },
        { $inc: { dneCoins: refundAmount }, $set: { updatedAt: new Date() } },
        { upsert: true }
      );
    }

    bet.status = 'cancelled';
    await bet.save();
    return bet;
  }

  /**
   * Resolves an active 1v1 P2P challenge and pays out 2x total pool to the winner.
   */
  public static async resolveP2PChallenge(params: {
    betId: string;
    callerId: string;
    isGuildAdmin: boolean;
    winnerUserId: string;
  }): Promise<{ winnerId: string; payout: number; bet: IBet }> {
    const { betId, callerId, isGuildAdmin, winnerUserId } = params;

    const bet = await BetModel.findOne({ betId });
    if (!bet) {
      throw new Error('Kèo cược không tồn tại!');
    }

    if (bet.kind !== 'p2p') {
      throw new Error('Kèo cược không phải là thách đấu 1v1!');
    }

    if (bet.status !== 'active') {
      throw new Error('Chỉ có thể phân định kèo đang hoạt động (active)!');
    }

    if (callerId !== bet.creatorId && !isGuildAdmin) {
      throw new Error('Bạn không có quyền phân định kết quả kèo cược này!');
    }

    if (winnerUserId !== bet.creatorId && winnerUserId !== bet.opponentId) {
      throw new Error('Người chiến thắng phải là người tham gia thách đấu!');
    }

    const payout = bet.totalPool;
    const now = new Date();

    // Award full pot to winner
    await UserStatModel.findOneAndUpdate(
      { guildId: bet.guildId, userId: winnerUserId },
      { $inc: { dneCoins: payout }, $set: { updatedAt: now } },
      { upsert: true }
    );

    bet.status = 'resolved';
    bet.winnerUserId = winnerUserId;
    const winnerWager = bet.wagers.find((w: Wager) => w.userId === winnerUserId);
    bet.winnerOption = winnerWager?.option || (winnerUserId === bet.creatorId ? bet.options[0] : bet.options[1]);
    bet.resolvedAt = now;

    await bet.save();
    return { winnerId: winnerUserId, payout, bet };
  }

  /**
   * Creates a community pool bet with multiple options.
   */
  public static async createCommunityPool(params: {
    guildId: string;
    creatorId: string;
    creatorUsername: string;
    title: string;
    options: string[];
    durationMs: number;
  }): Promise<IBet> {
    const { guildId, creatorId, creatorUsername, title, options, durationMs } = params;

    const cleanTitle = title?.trim();
    if (!cleanTitle) {
      throw new Error('Tiêu đề kèo cược không được để trống!');
    }

    const uniqueOptions = Array.from(new Set(options.map((o) => o.trim()))).filter(Boolean);
    if (uniqueOptions.length < 2) {
      throw new Error('Kèo cộng đồng cần ít nhất 2 lựa chọn khác nhau!');
    }

    if (durationMs <= 0) {
      throw new Error('Thời gian mở cược không hợp lệ!');
    }

    const betId = nanoid(10);
    const now = new Date();
    const expiresAt = new Date(Date.now() + durationMs);

    const bet = await BetModel.create({
      betId,
      guildId,
      kind: 'pool',
      creatorId,
      creatorUsername,
      title: cleanTitle,
      options: uniqueOptions,
      wagers: [],
      status: 'open',
      totalPool: 0,
      expiresAt,
      createdAt: now
    });

    return bet;
  }

  /**
   * Joins a community pool with an atomic coin escrow deduction.
   */
  public static async joinCommunityPool(params: {
    betId: string;
    userId: string;
    username: string;
    option: string;
    amount: number;
  }): Promise<IBet> {
    const { betId, userId, username, option, amount } = params;

    const bet = await BetModel.findOne({ betId });
    if (!bet) {
      throw new Error('Kèo cược không tồn tại!');
    }

    if (bet.kind !== 'pool') {
      throw new Error('Kèo cược không phải là kèo cộng đồng!');
    }

    if (bet.status !== 'open') {
      throw new Error('Kèo cược hiện không mở để đặt cược!');
    }

    const now = new Date();
    if (now >= bet.expiresAt) {
      throw new Error('Kèo cược đã hết hạn đặt cược!');
    }

    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Số xu cược phải là số nguyên dương lớn hơn 0!');
    }

    const cleanOption = option?.trim();
    if (!bet.options.includes(cleanOption)) {
      throw new Error(`Lựa chọn không hợp lệ! Các lựa chọn hợp lệ: ${bet.options.join(', ')}`);
    }

    // Atomic escrow deduction
    const updatedUser = await UserStatModel.findOneAndUpdate(
      { guildId: bet.guildId, userId, dneCoins: { $gte: amount } },
      { $inc: { dneCoins: -amount }, $set: { updatedAt: now } },
      { new: true }
    );

    if (!updatedUser) {
      throw new Error(`Bạn không đủ DNE Coins để đặt cược (cần ${amount} xu)!`);
    }

    bet.wagers.push({
      userId,
      username,
      option: cleanOption,
      amount,
      createdAt: now
    });

    bet.totalPool += amount;
    await bet.save();

    return bet;
  }

  /**
   * Resolves a community pool bet using pari-mutuel calculation.
   * If zero winners, refunds all wagers to players.
   */
  public static async resolveCommunityPool(params: {
    betId: string;
    callerId: string;
    isGuildAdmin: boolean;
    winningOption: string;
  }): Promise<{
    winningOption: string;
    totalWinners: number;
    totalPayout: number;
    refundsGiven?: boolean;
    bet: IBet;
  }> {
    const { betId, callerId, isGuildAdmin, winningOption } = params;

    const bet = await BetModel.findOne({ betId });
    if (!bet) {
      throw new Error('Kèo cược không tồn tại!');
    }

    if (bet.kind !== 'pool') {
      throw new Error('Kèo cược không phải là kèo cộng đồng!');
    }

    if (bet.status === 'resolved' || bet.status === 'cancelled') {
      throw new Error('Kèo cược đã được giải quyết hoặc đã bị hủy!');
    }

    if (callerId !== bet.creatorId && !isGuildAdmin) {
      throw new Error('Bạn không có quyền phân định kết quả kèo cược này!');
    }

    const cleanWinningOption = winningOption?.trim();
    if (!bet.options.includes(cleanWinningOption)) {
      throw new Error('Lựa chọn chiến thắng không hợp lệ!');
    }

    const now = new Date();
    const winningWagers = bet.wagers.filter((w: Wager) => w.option === cleanWinningOption);

    // Case 1: Nobody picked the winning option -> Refund all players
    if (winningWagers.length === 0) {
      const refundMap = new Map<string, number>();
      for (const w of bet.wagers) {
        refundMap.set(w.userId, (refundMap.get(w.userId) || 0) + w.amount);
      }

      for (const [uid, refundAmount] of refundMap.entries()) {
        await UserStatModel.findOneAndUpdate(
          { guildId: bet.guildId, userId: uid },
          { $inc: { dneCoins: refundAmount }, $set: { updatedAt: now } },
          { upsert: true }
        );
      }

      bet.status = 'resolved';
      bet.winnerOption = cleanWinningOption;
      bet.resolvedAt = now;
      await bet.save();

      return {
        winningOption: cleanWinningOption,
        totalWinners: 0,
        totalPayout: 0,
        refundsGiven: true,
        bet
      };
    }

    // Case 2: Pari-mutuel proportional distribution
    const winningPool = winningWagers.reduce((sum: number, w: Wager) => sum + w.amount, 0);
    const userWinnings = new Map<string, number>();
    for (const w of winningWagers) {
      userWinnings.set(w.userId, (userWinnings.get(w.userId) || 0) + w.amount);
    }

    let totalPayout = 0;
    for (const [uid, userBetAmount] of userWinnings.entries()) {
      const payout = Math.floor((userBetAmount / winningPool) * bet.totalPool);
      totalPayout += payout;

      await UserStatModel.findOneAndUpdate(
        { guildId: bet.guildId, userId: uid },
        { $inc: { dneCoins: payout }, $set: { updatedAt: now } },
        { upsert: true }
      );
    }

    bet.status = 'resolved';
    bet.winnerOption = cleanWinningOption;
    bet.resolvedAt = now;
    await bet.save();

    return {
      winningOption: cleanWinningOption,
      totalWinners: userWinnings.size,
      totalPayout,
      refundsGiven: false,
      bet
    };
  }
}
