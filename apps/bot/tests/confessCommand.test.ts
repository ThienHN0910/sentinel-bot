import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionFlagsBits } from 'discord.js';
import {
  handleConfessCommand,
  handleConfessModalSubmit,
  handleConfessButton,
  handleDirectMessageConfession,
  pendingDmConfessions,
  clearPendingDmConfessions
} from '../src/commands/confess';
import { ConfessionService } from '../src/services/confession/ConfessionService';
import { GuildConfigModel } from '../src/models/GuildConfig';
import { onInteractionCreate } from '../src/events/interactionCreate';
import { onMessageCreate } from '../src/events/messageCreate';
import { AnalyticsService } from '../src/services/analytics/AnalyticsService';

function createMockChatInputInteraction(options: {
  guildId?: string | null;
  userId?: string;
  subcommand?: string | null;
  confessionNumber?: number;
  channelId?: string;
  hasManageGuild?: boolean;
}) {
  const {
    guildId = 'guild-123',
    userId = 'user-abc',
    subcommand = null,
    confessionNumber = 1,
    channelId = 'channel-confess-456',
    hasManageGuild = true
  } = options;

  return {
    isChatInputCommand: () => true,
    isButton: () => false,
    isModalSubmit: () => false,
    commandName: 'confess',
    guildId,
    guild: guildId ? { id: guildId, name: 'Test Guild' } : null,
    user: { id: userId, username: 'testuser' },
    memberPermissions: {
      has: vi.fn().mockImplementation((perm: bigint) => {
        if (perm === PermissionFlagsBits.ManageGuild) {
          return hasManageGuild;
        }
        return false;
      })
    },
    options: {
      getSubcommand: vi.fn().mockReturnValue(subcommand),
      getInteger: vi.fn().mockImplementation((name: string) => {
        if (name === 'number' || name === 'id') return confessionNumber;
        return null;
      }),
      getChannel: vi.fn().mockImplementation((name: string) => {
        if (name === 'channel') return { id: channelId };
        return null;
      })
    },
    client: {} as any,
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    showModal: vi.fn().mockResolvedValue(undefined)
  } as any;
}

function createMockModalSubmitInteraction(options: {
  guildId?: string | null;
  userId?: string;
  customId?: string;
  content?: string;
}) {
  const {
    guildId = 'guild-123',
    userId = 'user-abc',
    customId = 'confess_modal',
    content = 'This is a valid test confession content with more than 10 chars.'
  } = options;

  return {
    isChatInputCommand: () => false,
    isButton: () => false,
    isModalSubmit: () => true,
    customId,
    guildId,
    guild: guildId ? { id: guildId, name: 'Test Guild' } : null,
    user: { id: userId, username: 'testuser' },
    fields: {
      getTextInputValue: vi.fn().mockImplementation((id: string) => {
        if (id === 'content') return content;
        return '';
      })
    },
    client: {} as any,
    reply: vi.fn().mockResolvedValue(undefined),
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined)
  } as any;
}

function createMockButtonInteraction(options: {
  customId: string;
  userId?: string;
  components?: any[];
}) {
  const {
    customId,
    userId = 'user-abc',
    components = []
  } = options;

  return {
    isChatInputCommand: () => false,
    isButton: () => true,
    isModalSubmit: () => false,
    customId,
    user: { id: userId, username: 'testuser' },
    message: {
      components,
      edit: vi.fn().mockResolvedValue(undefined)
    },
    client: {} as any,
    reply: vi.fn().mockResolvedValue(undefined),
    update: vi.fn().mockResolvedValue(undefined),
    deferUpdate: vi.fn().mockResolvedValue(undefined)
  } as any;
}

function createMockMessage(options: {
  content: string;
  isBot?: boolean;
  isDM?: boolean;
  userId?: string;
  guilds?: any[];
}) {
  const {
    content,
    isBot = false,
    isDM = true,
    userId = 'user-abc',
    guilds = []
  } = options;

  const guildCache = new Map<string, any>();
  for (const g of guilds) {
    guildCache.set(g.id, g);
  }

  return {
    content,
    author: { id: userId, username: 'dmuser', bot: isBot },
    guild: isDM ? null : { id: 'guild-123' },
    guildId: isDM ? null : 'guild-123',
    client: {
      guilds: {
        cache: guildCache
      }
    },
    reply: vi.fn().mockResolvedValue(undefined)
  } as any;
}

describe('Confess Command & Interactions', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    ConfessionService.clearRateLimits();
    clearPendingDmConfessions();
  });

  describe('Slash Command /confess (Modal Trigger)', () => {
    it('shows modal when executed in guild by user not on cooldown', async () => {
      const interaction = createMockChatInputInteraction({ subcommand: null });

      await handleConfessCommand(interaction);

      expect(interaction.showModal).toHaveBeenCalledTimes(1);
      const modal = (interaction.showModal as any).mock.calls[0][0];
      expect(modal.data.custom_id).toBe('confess_modal');
      expect(modal.components[0].components[0].data.custom_id).toBe('content');
    });

    it('rejects command if executed outside of a guild', async () => {
      const interaction = createMockChatInputInteraction({ guildId: null });

      await handleConfessCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('chỉ dùng trong server'),
          ephemeral: true
        })
      );
      expect(interaction.showModal).not.toHaveBeenCalled();
    });

    it('rejects showing modal if user is currently rate limited', async () => {
      vi.spyOn(ConfessionService, 'checkRateLimit').mockReturnValue({
        allowed: false,
        retryAfterSeconds: 150
      });

      const interaction = createMockChatInputInteraction({ subcommand: null });

      await handleConfessCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('150 giây'),
          ephemeral: true
        })
      );
      expect(interaction.showModal).not.toHaveBeenCalled();
    });
  });

  describe('Admin Subcommand /confess delete', () => {
    it('rejects user without ManageGuild permission', async () => {
      const interaction = createMockChatInputInteraction({
        subcommand: 'delete',
        hasManageGuild: false,
        confessionNumber: 5
      });

      const deleteSpy = vi.spyOn(ConfessionService, 'deleteConfession');

      await handleConfessCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('quyền'),
          ephemeral: true
        })
      );
      expect(deleteSpy).not.toHaveBeenCalled();
    });

    it('calls ConfessionService.deleteConfession and reports success when authorized', async () => {
      const interaction = createMockChatInputInteraction({
        subcommand: 'delete',
        hasManageGuild: true,
        confessionNumber: 5
      });

      const deleteSpy = vi.spyOn(ConfessionService, 'deleteConfession').mockResolvedValue(true);

      await handleConfessCommand(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(deleteSpy).toHaveBeenCalledWith({
        guildId: 'guild-123',
        confessionNumber: 5,
        client: interaction.client
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đã xóa confession #5')
        })
      );
    });

    it('reports failure when confession is not found', async () => {
      const interaction = createMockChatInputInteraction({
        subcommand: 'delete',
        hasManageGuild: true,
        confessionNumber: 99
      });

      vi.spyOn(ConfessionService, 'deleteConfession').mockResolvedValue(false);

      await handleConfessCommand(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Không tìm thấy confession #99')
        })
      );
    });

    it('works with "id" option as registered in ready.ts', async () => {
      const interaction = createMockChatInputInteraction({
        subcommand: 'delete',
        hasManageGuild: true,
        confessionNumber: 12
      });

      const deleteSpy = vi.spyOn(ConfessionService, 'deleteConfession').mockResolvedValue(true);

      await handleConfessCommand(interaction);

      expect(deleteSpy).toHaveBeenCalledWith({
        guildId: 'guild-123',
        confessionNumber: 12,
        client: interaction.client
      });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đã xóa confession #12')
        })
      );
    });
  });

  describe('Admin Subcommand /confess config', () => {
    it('rejects user without ManageGuild permission', async () => {
      const interaction = createMockChatInputInteraction({
        subcommand: 'config',
        hasManageGuild: false
      });

      await handleConfessCommand(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('quyền'),
          ephemeral: true
        })
      );
    });

    it('updates confessionChannelId in GuildConfigModel when authorized', async () => {
      const interaction = createMockChatInputInteraction({
        subcommand: 'config',
        hasManageGuild: true,
        channelId: 'channel-confess-777'
      });

      const findOneAndUpdateSpy = vi.spyOn(GuildConfigModel, 'findOneAndUpdate').mockResolvedValue({} as any);

      await handleConfessCommand(interaction);

      expect(findOneAndUpdateSpy).toHaveBeenCalledWith(
        { guildId: 'guild-123' },
        expect.objectContaining({
          $set: expect.objectContaining({ confessionChannelId: 'channel-confess-777' })
        }),
        { upsert: true }
      );
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('<#channel-confess-777>')
        })
      );
    });
  });

  describe('Modal Submission (confess_modal)', () => {
    it('rejects submission with content shorter than 10 characters', async () => {
      const interaction = createMockModalSubmitInteraction({ content: 'Short' });
      const postSpy = vi.spyOn(ConfessionService, 'postConfession');

      await handleConfessModalSubmit(interaction);

      expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('từ 10 đến 1000 ký tự')
        })
      );
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('rejects submission if user triggers rate limit upon submission', async () => {
      vi.spyOn(ConfessionService, 'checkRateLimit').mockReturnValue({
        allowed: false,
        retryAfterSeconds: 240
      });
      const postSpy = vi.spyOn(ConfessionService, 'postConfession');

      const interaction = createMockModalSubmitInteraction({
        content: 'Valid confession message but user is on cooldown.'
      });

      await handleConfessModalSubmit(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('240 giây')
        })
      );
      expect(postSpy).not.toHaveBeenCalled();
    });

    it('posts confession and replies ephemerally with zero-trace guarantee', async () => {
      const postSpy = vi.spyOn(ConfessionService, 'postConfession').mockResolvedValue({
        confessionNumber: 42,
        messageId: 'msg-42'
      });

      const interaction = createMockModalSubmitInteraction({
        content: 'I secretly love writing unit tests before implementation!'
      });

      await handleConfessModalSubmit(interaction);

      expect(postSpy).toHaveBeenCalledWith({
        guildId: 'guild-123',
        content: 'I secretly love writing unit tests before implementation!',
        client: interaction.client
      });

      // Verify ZERO-TRACE: neither userId nor user object was passed to postConfession
      const callArgs = postSpy.mock.calls[0][0] as any;
      expect(callArgs.userId).toBeUndefined();
      expect(callArgs.user).toBeUndefined();
      expect(callArgs.authorId).toBeUndefined();

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Confession #42 của bạn đã được đăng ẩn danh')
        })
      );
    });

    it('handles postConfession error gracefully (e.g. channel not configured)', async () => {
      vi.spyOn(ConfessionService, 'postConfession').mockRejectedValue(
        new Error('Confession channel is not configured')
      );

      const interaction = createMockModalSubmitInteraction({
        content: 'Valid confession message trying to post.'
      });

      await handleConfessModalSubmit(interaction);

      expect(interaction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Confession channel is not configured')
        })
      );
    });
  });

  describe('DM Confession Listener (handleDirectMessageConfession)', () => {
    it('ignores bot messages in DM', async () => {
      const message = createMockMessage({ content: 'Confession in DM', isBot: true });
      await handleDirectMessageConfession(message);
      expect(message.reply).not.toHaveBeenCalled();
    });

    it('rejects short messages in DM', async () => {
      const message = createMockMessage({ content: 'Hi bot' });
      await handleDirectMessageConfession(message);
      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining('từ 10 đến 1000 ký tự')
      );
    });

    it('replies with error if no mutual guilds are found', async () => {
      const message = createMockMessage({
        content: 'This is my deep dark secret sent via DM.',
        guilds: []
      });

      await handleDirectMessageConfession(message);

      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining('không có server chung nào')
      );
    });

    it('creates draft and prompts confirmation buttons for mutual guilds', async () => {
      const mockGuild = {
        id: 'guild-456',
        name: 'Sentinel Community',
        members: {
          cache: new Map([['user-abc', { id: 'user-abc' }]])
        }
      };

      const message = createMockMessage({
        content: 'This is my deep dark secret sent via DM.',
        userId: 'user-abc',
        guilds: [mockGuild]
      });

      await handleDirectMessageConfession(message);

      expect(pendingDmConfessions.has('user-abc')).toBe(true);
      expect(pendingDmConfessions.get('user-abc')?.content).toBe(
        'This is my deep dark secret sent via DM.'
      );

      expect(message.reply).toHaveBeenCalledTimes(1);
      const replyArg = (message.reply as any).mock.calls[0][0];
      expect(replyArg.embeds[0].data.title).toContain('Xác nhận gửi Confession');
      expect(replyArg.components[0].components[0].data.custom_id).toBe(
        'confess:dm_send:guild-456'
      );
      expect(replyArg.components[0].components[1].data.custom_id).toBe(
        'confess:dm_cancel'
      );
    });
  });

  describe('Button Interactions (handleConfessButton)', () => {
    it('handles confess:dm_cancel by deleting draft and updating interaction message', async () => {
      pendingDmConfessions.set('user-abc', {
        content: 'Some confession',
        expiresAt: Date.now() + 60000
      });

      const interaction = createMockButtonInteraction({
        customId: 'confess:dm_cancel',
        userId: 'user-abc'
      });

      await handleConfessButton(interaction);

      expect(pendingDmConfessions.has('user-abc')).toBe(false);
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Đã hủy'),
          components: []
        })
      );
    });

    it('handles confess:dm_send by posting confession and clearing draft', async () => {
      pendingDmConfessions.set('user-abc', {
        content: 'Draft DM confession to post',
        expiresAt: Date.now() + 60000
      });

      const postSpy = vi.spyOn(ConfessionService, 'postConfession').mockResolvedValue({
        confessionNumber: 77,
        messageId: 'msg-77'
      });

      const interaction = createMockButtonInteraction({
        customId: 'confess:dm_send:guild-456',
        userId: 'user-abc'
      });

      await handleConfessButton(interaction);

      expect(postSpy).toHaveBeenCalledWith({
        guildId: 'guild-456',
        content: 'Draft DM confession to post',
        client: interaction.client
      });

      expect(pendingDmConfessions.has('user-abc')).toBe(false);
      expect(interaction.update).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Confession #77 của bạn đã được đăng ẩn danh'),
          components: []
        })
      );
    });

    it('rejects confess:dm_send if draft expired or not found', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'confess:dm_send:guild-456',
        userId: 'user-abc'
      });

      await handleConfessButton(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('hết hạn hoặc không tìm thấy'),
          ephemeral: true
        })
      );
    });

    it('increments heart reaction counter on message component and replies ephemerally', async () => {
      const mockComponents = [
        {
          components: [
            {
              customId: 'confess:react:heart:10',
              label: 'Yêu thích (0)',
              emoji: { name: '❤️' },
              style: 2,
              data: {
                custom_id: 'confess:react:heart:10',
                label: 'Yêu thích (0)',
                emoji: { name: '❤️' },
                style: 2
              }
            },
            {
              customId: 'confess:react:laugh:10',
              label: 'Haha (0)',
              emoji: { name: '😂' },
              style: 2,
              data: {
                custom_id: 'confess:react:laugh:10',
                label: 'Haha (0)',
                emoji: { name: '😂' },
                style: 2
              }
            }
          ]
        }
      ];

      const interaction = createMockButtonInteraction({
        customId: 'confess:react:heart:10',
        components: mockComponents
      });

      await handleConfessButton(interaction);

      expect(interaction.message.edit).toHaveBeenCalledTimes(1);
      const editedCall = (interaction.message.edit as any).mock.calls[0][0];
      const heartBtn = editedCall.components[0].components[0];
      expect(heartBtn.data.label).toBe('Yêu thích (1)');

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Yêu thích'),
          ephemeral: true
        })
      );
    });

    it('increments laugh reaction counter on message component and replies ephemerally', async () => {
      const mockComponents = [
        {
          components: [
            {
              customId: 'confess:react:laugh:10',
              label: 'Haha (5)',
              emoji: { name: '😂' },
              style: 2,
              data: {
                custom_id: 'confess:react:laugh:10',
                label: 'Haha (5)',
                emoji: { name: '😂' },
                style: 2
              }
            }
          ]
        }
      ];

      const interaction = createMockButtonInteraction({
        customId: 'confess:react:laugh:10',
        components: mockComponents
      });

      await handleConfessButton(interaction);

      expect(interaction.message.edit).toHaveBeenCalledTimes(1);
      const editedCall = (interaction.message.edit as any).mock.calls[0][0];
      const laughBtn = editedCall.components[0].components[0];
      expect(laughBtn.data.label).toBe('Haha (6)');

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('Haha'),
          ephemeral: true
        })
      );
    });

    it('replies ephemerally to discuss button without modifying counters', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'confess:react:discuss:10',
        components: []
      });

      await handleConfessButton(interaction);

      expect(interaction.message.edit).not.toHaveBeenCalled();
      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('thảo luận'),
          ephemeral: true
        })
      );
    });
  });

  describe('Event Integration (interactionCreate & messageCreate)', () => {
    it('routes confess slash command via onInteractionCreate', async () => {
      const interaction = createMockChatInputInteraction({ subcommand: null });
      await onInteractionCreate(interaction);
      expect(interaction.showModal).toHaveBeenCalledTimes(1);
    });

    it('routes confess_modal submit via onInteractionCreate', async () => {
      vi.spyOn(ConfessionService, 'postConfession').mockResolvedValue({
        confessionNumber: 1,
        messageId: 'msg-1'
      });

      const interaction = createMockModalSubmitInteraction({
        content: 'Valid confession passed through router'
      });

      await onInteractionCreate(interaction);

      expect(interaction.deferReply).toHaveBeenCalled();
    });

    it('routes confess buttons via onInteractionCreate', async () => {
      const interaction = createMockButtonInteraction({
        customId: 'confess:react:discuss:1'
      });

      await onInteractionCreate(interaction);

      expect(interaction.reply).toHaveBeenCalledWith(
        expect.objectContaining({
          ephemeral: true
        })
      );
    });

    it('routes DM message to confession handler via onMessageCreate', async () => {
      const message = createMockMessage({
        content: 'Secret from DM passed through onMessageCreate',
        isDM: true
      });

      const analyticsSpy = vi.spyOn(AnalyticsService, 'handleMessage');

      await onMessageCreate(message);

      expect(analyticsSpy).not.toHaveBeenCalled();
      // Mutual guilds was empty so it replies with error message
      expect(message.reply).toHaveBeenCalledWith(
        expect.stringContaining('không có server chung nào')
      );
    });

    it('routes Guild message to AnalyticsService via onMessageCreate', async () => {
      const message = createMockMessage({
        content: 'Normal guild message',
        isDM: false
      });

      const analyticsSpy = vi.spyOn(AnalyticsService, 'handleMessage').mockResolvedValue(undefined as never);

      await onMessageCreate(message);

      expect(analyticsSpy).toHaveBeenCalledWith(message);
    });
  });
});
