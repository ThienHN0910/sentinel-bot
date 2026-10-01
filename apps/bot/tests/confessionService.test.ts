import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfessionModel } from '../src/models/Confession';
import { GuildConfigModel } from '../src/models/GuildConfig';
import { ConfessionService } from '../src/services/confession/ConfessionService';

describe('ConfessionService & Zero-Trace Confession Persistence', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ConfessionService.clearRateLimits();
  });

  describe('Zero-Trace Anonymity & Schema Integrity', () => {
    it('strictly does NOT contain any author or user identifying fields in schema', () => {
      const paths = Object.keys(ConfessionModel.schema.paths);

      // Verify required zero-trace constraints
      expect(paths).not.toContain('userId');
      expect(paths).not.toContain('authorId');
      expect(paths).not.toContain('user');
      expect(paths).not.toContain('author');
      expect(paths).not.toContain('username');
      expect(paths).not.toContain('tag');
      expect(paths).not.toContain('sender');
      expect(paths).not.toContain('senderId');

      // Verify required persistence fields
      expect(paths).toContain('guildId');
      expect(paths).toContain('confessionNumber');
      expect(paths).toContain('content');
      expect(paths).toContain('messageId');
      expect(paths).toContain('createdAt');
    });
  });

  describe('Sequential Confession Numbering', () => {
    it('returns 1 for a guild with no previous confessions', async () => {
      vi.spyOn(ConfessionModel, 'findOne').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue(null)
        })
      } as never);

      const nextNum = await ConfessionService.getNextConfessionNumber('guild-1');
      expect(nextNum).toBe(1);
    });

    it('increments sequence number based on highest confessionNumber in guild', async () => {
      vi.spyOn(ConfessionModel, 'findOne').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ confessionNumber: 41 })
        })
      } as never);

      const nextNum = await ConfessionService.getNextConfessionNumber('guild-1');
      expect(nextNum).toBe(42);
    });
  });

  describe('5-Minute In-Memory Rate Limiting', () => {
    it('allows initial confession and rejects rapid repeats within 5 minutes', () => {
      const t0 = new Date('2026-10-01T12:00:00Z');
      const userId = 'user-123';

      // 1st attempt: allowed
      const res1 = ConfessionService.checkRateLimit(userId, t0);
      expect(res1.allowed).toBe(true);
      expect(res1.retryAfterSeconds).toBe(0);

      // 2nd attempt 60 seconds later: rejected
      const t1 = new Date(t0.getTime() + 60_000);
      const res2 = ConfessionService.checkRateLimit(userId, t1);
      expect(res2.allowed).toBe(false);
      expect(res2.retryAfterSeconds).toBe(240);

      // 3rd attempt after 5 minutes (300 seconds): allowed
      const t2 = new Date(t0.getTime() + 300_000);
      const res3 = ConfessionService.checkRateLimit(userId, t2);
      expect(res3.allowed).toBe(true);
      expect(res3.retryAfterSeconds).toBe(0);
    });

    it('tracks rate limits independently across different users', () => {
      const now = new Date('2026-10-01T12:00:00Z');
      const resUser1 = ConfessionService.checkRateLimit('user-1', now);
      const resUser2 = ConfessionService.checkRateLimit('user-2', now);

      expect(resUser1.allowed).toBe(true);
      expect(resUser2.allowed).toBe(true);
    });

    it('sweeps expired cooldowns while retaining active cooldowns', () => {
      const t0 = new Date('2026-10-01T12:00:00Z');
      ConfessionService.checkRateLimit('user-old', t0);

      const t1 = new Date(t0.getTime() + 4 * 60_000);
      ConfessionService.checkRateLimit('user-recent', t1);

      // 5.5 minutes after t0
      const tSweep = t0.getTime() + 5.5 * 60_000;
      ConfessionService.sweepExpiredCooldowns(tSweep);

      // user-old was expired and deleted by sweep
      const resOld = ConfessionService.checkRateLimit('user-old', new Date(tSweep));
      expect(resOld.allowed).toBe(true);

      // user-recent is only 1.5 minutes old at tSweep, so still rate limited
      const resRecent = ConfessionService.checkRateLimit('user-recent', new Date(tSweep));
      expect(resRecent.allowed).toBe(false);
    });
  });

  describe('postConfession', () => {
    it('throws error if confession channel is not configured in guild', async () => {
      vi.spyOn(GuildConfigModel, 'findOne').mockResolvedValue(null as never);

      const client = { channels: { fetch: vi.fn() } } as never;

      await expect(
        ConfessionService.postConfession({
          guildId: 'guild-1',
          content: 'Confession test',
          client
        })
      ).rejects.toThrow('Confession channel is not configured');
    });

    it('throws error if configured channel cannot be fetched or is not text-based', async () => {
      vi.spyOn(GuildConfigModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        confessionChannelId: 'channel-999'
      } as never);

      const client = {
        channels: { fetch: vi.fn().mockResolvedValue(null) }
      } as never;

      await expect(
        ConfessionService.postConfession({
          guildId: 'guild-1',
          content: 'Confession test',
          client
        })
      ).rejects.toThrow('Confession channel not found or invalid');
    });

    it('formats embed with reaction buttons and persists confession record without author', async () => {
      vi.spyOn(GuildConfigModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        confessionChannelId: 'channel-confess'
      } as never);

      vi.spyOn(ConfessionModel, 'findOne').mockReturnValue({
        sort: vi.fn().mockReturnValue({
          select: vi.fn().mockResolvedValue({ confessionNumber: 6 })
        })
      } as never);

      const createSpy = vi.spyOn(ConfessionModel, 'create').mockResolvedValue({
        guildId: 'guild-1',
        confessionNumber: 7,
        content: 'Tôi thích một bạn trong voice chat...',
        messageId: 'discord-msg-7',
        createdAt: new Date()
      } as never);

      const sendMock = vi.fn().mockResolvedValue({ id: 'discord-msg-7' });
      const channelMock = {
        id: 'channel-confess',
        isTextBased: () => true,
        send: sendMock
      };

      const client = {
        channels: { fetch: vi.fn().mockResolvedValue(channelMock) }
      } as never;

      const result = await ConfessionService.postConfession({
        guildId: 'guild-1',
        content: 'Tôi thích một bạn trong voice chat...',
        client
      });

      expect(result).toEqual({
        confessionNumber: 7,
        messageId: 'discord-msg-7'
      });

      // Verify Discord send payload
      expect(sendMock).toHaveBeenCalledTimes(1);
      const callArgs = sendMock.mock.calls[0][0];

      // Check Embed
      expect(callArgs.embeds).toBeDefined();
      expect(callArgs.embeds).toHaveLength(1);
      const embed = callArgs.embeds[0].data || callArgs.embeds[0];
      expect(embed.title).toBe('📬 CONFESSION #7');
      expect(embed.description).toBe('Tôi thích một bạn trong voice chat...');
      expect(embed.color).toBe(0x5865f2);

      // Check ActionRow & Buttons
      expect(callArgs.components).toBeDefined();
      expect(callArgs.components).toHaveLength(1);
      const row = callArgs.components[0];
      const buttons = row.components || row.data?.components;
      expect(buttons).toHaveLength(3);

      const b0 = buttons[0].data || buttons[0];
      const b1 = buttons[1].data || buttons[1];
      const b2 = buttons[2].data || buttons[2];

      expect(b0.custom_id).toBe('confess:react:heart:7');
      expect(b0.label).toBe('Yêu thích (0)');
      expect(b0.emoji?.name).toBe('❤️');

      expect(b1.custom_id).toBe('confess:react:laugh:7');
      expect(b1.label).toBe('Haha (0)');
      expect(b1.emoji?.name).toBe('😂');

      expect(b2.custom_id).toBe('confess:react:discuss:7');
      expect(b2.label).toBe('Thảo luận');
      expect(b2.emoji?.name).toBe('💬');

      // Verify DB persistence parameters: MUST NOT have author/user data
      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          guildId: 'guild-1',
          confessionNumber: 7,
          content: 'Tôi thích một bạn trong voice chat...',
          messageId: 'discord-msg-7'
        })
      );
      const createdObj = createSpy.mock.calls[0][0] as Record<string, unknown>;
      expect(createdObj).not.toHaveProperty('userId');
      expect(createdObj).not.toHaveProperty('authorId');
    });

    it('retries up to 3 times on MongoDB duplicate key collision (code 11000) and updates message', async () => {
      vi.spyOn(GuildConfigModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        confessionChannelId: 'channel-confess'
      } as never);

      let numberCallCount = 0;
      vi.spyOn(ConfessionService, 'getNextConfessionNumber').mockImplementation(async () => {
        numberCallCount++;
        return numberCallCount === 1 ? 5 : 6;
      });

      const editMock = vi.fn().mockResolvedValue({});
      const sendMock = vi.fn().mockResolvedValue({ id: 'msg-collision', edit: editMock });
      const channelMock = {
        id: 'channel-confess',
        isTextBased: () => true,
        send: sendMock
      };

      const client = {
        channels: { fetch: vi.fn().mockResolvedValue(channelMock) }
      } as never;

      const dupError: any = new Error('E11000 duplicate key error');
      dupError.code = 11000;

      const createSpy = vi.spyOn(ConfessionModel, 'create')
        .mockRejectedValueOnce(dupError)
        .mockResolvedValueOnce({
          guildId: 'guild-1',
          confessionNumber: 6,
          content: 'Confession retry test',
          messageId: 'msg-collision',
          createdAt: new Date()
        } as never);

      const result = await ConfessionService.postConfession({
        guildId: 'guild-1',
        content: 'Confession retry test',
        client
      });

      expect(result.confessionNumber).toBe(6);
      expect(result.messageId).toBe('msg-collision');
      expect(createSpy).toHaveBeenCalledTimes(2);
      expect(editMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('deleteConfession', () => {
    it('returns false if confession does not exist in DB', async () => {
      vi.spyOn(ConfessionModel, 'findOne').mockResolvedValue(null as never);

      const client = { channels: { fetch: vi.fn() } } as never;
      const res = await ConfessionService.deleteConfession({
        guildId: 'guild-1',
        confessionNumber: 99,
        client
      });

      expect(res).toBe(false);
    });

    it('deletes message from Discord channel and deletes DB record', async () => {
      vi.spyOn(ConfessionModel, 'findOne').mockResolvedValue({
        _id: 'db-id-1',
        guildId: 'guild-1',
        confessionNumber: 5,
        messageId: 'msg-to-delete'
      } as never);

      vi.spyOn(GuildConfigModel, 'findOne').mockResolvedValue({
        guildId: 'guild-1',
        confessionChannelId: 'channel-confess'
      } as never);

      const deleteMessageMock = vi.fn().mockResolvedValue(true);
      const channelMock = {
        isTextBased: () => true,
        messages: {
          fetch: vi.fn().mockResolvedValue({ delete: deleteMessageMock })
        }
      };

      const client = {
        channels: { fetch: vi.fn().mockResolvedValue(channelMock) }
      } as never;

      const deleteDocMock = vi.spyOn(ConfessionModel, 'deleteOne').mockResolvedValue({ deletedCount: 1 } as never);

      const res = await ConfessionService.deleteConfession({
        guildId: 'guild-1',
        confessionNumber: 5,
        client
      });

      expect(res).toBe(true);
      expect(deleteMessageMock).toHaveBeenCalledTimes(1);
      expect(deleteDocMock).toHaveBeenCalledWith(
        expect.objectContaining({ guildId: 'guild-1', confessionNumber: 5 })
      );
    });
  });
});
