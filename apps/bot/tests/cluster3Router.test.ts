import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ButtonInteraction, ChatInputCommandInteraction } from 'discord.js';
import { slashCommands } from '../src/events/ready.js';
import { onInteractionCreate } from '../src/events/interactionCreate.js';
import * as commandsIndex from '../src/commands/index.js';
import { handlePetCommand, handlePetButton } from '../src/commands/pet.js';
import { handleBadgeCommand } from '../src/commands/badge.js';
import { handleProfileCommand, handleProfileButton } from '../src/commands/profile.js';

vi.mock('../src/commands/pet.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/commands/pet.js')>();
  return {
    ...actual,
    handlePetCommand: vi.fn().mockResolvedValue(undefined),
    handlePetButton: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('../src/commands/badge.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/commands/badge.js')>();
  return {
    ...actual,
    handleBadgeCommand: vi.fn().mockResolvedValue(undefined)
  };
});

vi.mock('../src/commands/profile.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/commands/profile.js')>();
  return {
    ...actual,
    handleProfileCommand: vi.fn().mockResolvedValue(undefined),
    handleProfileButton: vi.fn().mockResolvedValue(undefined)
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

describe('Cluster 3 Router and Integration (/pet, /badge, /profile)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('commands/index.ts exports', () => {
    it('re-exports /pet commands and handlers', () => {
      expect(commandsIndex).toHaveProperty('petSlashCommand');
      expect(commandsIndex).toHaveProperty('handlePetCommand');
      expect(commandsIndex).toHaveProperty('handlePetButton');
    });

    it('re-exports /badge commands and handlers', () => {
      expect(commandsIndex).toHaveProperty('badgeSlashCommand');
      expect(commandsIndex).toHaveProperty('handleBadgeCommand');
      expect(commandsIndex).toHaveProperty('createBadgeListEmbed');
    });

    it('re-exports /profile commands and handlers', () => {
      expect(commandsIndex).toHaveProperty('profileSlashCommand');
      expect(commandsIndex).toHaveProperty('handleProfileCommand');
      expect(commandsIndex).toHaveProperty('handleProfileButton');
    });
  });

  describe('ready.ts slashCommands registration', () => {
    it('registers pet, badge, and profile commands', () => {
      const commandNames = slashCommands.map((c: any) => c.name);
      expect(commandNames).toContain('pet');
      expect(commandNames).toContain('badge');
      expect(commandNames).toContain('profile');
    });
  });

  describe('interactionCreate.ts routing', () => {
    it('routes pet slash command to handlePetCommand', async () => {
      const interaction = createMockChatInputInteraction('pet');
      await onInteractionCreate(interaction);
      expect(handlePetCommand).toHaveBeenCalledTimes(1);
      expect(handlePetCommand).toHaveBeenCalledWith(interaction);
    });

    it('routes badge slash command to handleBadgeCommand', async () => {
      const interaction = createMockChatInputInteraction('badge');
      await onInteractionCreate(interaction);
      expect(handleBadgeCommand).toHaveBeenCalledTimes(1);
      expect(handleBadgeCommand).toHaveBeenCalledWith(interaction);
    });

    it('routes profile slash command to handleProfileCommand', async () => {
      const interaction = createMockChatInputInteraction('profile');
      await onInteractionCreate(interaction);
      expect(handleProfileCommand).toHaveBeenCalledTimes(1);
      expect(handleProfileCommand).toHaveBeenCalledWith(interaction);
    });

    it('routes pet: buttons to handlePetButton', async () => {
      const feedButton = createMockButtonInteraction('pet:feed:target-user');
      await onInteractionCreate(feedButton);
      expect(handlePetButton).toHaveBeenCalledTimes(1);
      expect(handlePetButton).toHaveBeenCalledWith(feedButton);

      const playButton = createMockButtonInteraction('pet:play:target-user');
      await onInteractionCreate(playButton);
      expect(handlePetButton).toHaveBeenCalledTimes(2);
      expect(handlePetButton).toHaveBeenCalledWith(playButton);
    });

    it('routes profile:badges: buttons to handleProfileButton', async () => {
      const profileButton = createMockButtonInteraction('profile:badges:user-target-123');
      await onInteractionCreate(profileButton);
      expect(handleProfileButton).toHaveBeenCalledTimes(1);
      expect(handleProfileButton).toHaveBeenCalledWith(profileButton);
    });
  });
});
