import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { GameSessionView } from '@sentinel/shared';
import * as service from '../src/services/game/GameSessionService';
import { handleGameButton, handleNewGameCommand, handleOpenGameCommand, renderGameMessage } from '../src/commands/gameSessions';
import { slashCommands } from '../src/events/ready';

const id = 'abcdefghijklmnopqrstu';
const view = (part: Partial<GameSessionView> = {}): GameSessionView => ({
  sessionId: id, guildId: '123456789012345678', kind: 'rps', creatorId: '234567890123456789',
  opponentId: null, phase: 'waiting', expiresAt: new Date(Date.now() + 900000).toISOString(), ...part
});

describe('shared Discord games', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('registers the three shared game subcommands', () => {
    expect(slashCommands.find(command => command.name === 'game')?.options?.map(option => option.name))
      .toEqual(['wordchain', 'noitu', 'baucua', 'tictactoe', 'rps', 'open']);
  });

  it('keeps an unpaired RPS choice out of the public message', () => {
    const message = renderGameMessage(view({ phase: 'active', opponentId: '345678901234567890',
      rps: { creatorChosen: true, opponentChosen: false, ownChoice: 'rock' } }));
    expect(JSON.stringify(message)).not.toContain('rock');
    expect(JSON.stringify(message)).toContain('đã chọn');
  });

  it('creates a guild game with a public join button', async () => {
    vi.spyOn(service, 'createGameSession').mockResolvedValue(view());
    vi.spyOn(service, 'attachGameMessage').mockResolvedValue(view({ discordMessageUrl: `https://discord.com/channels/123/456/789` }));
    const message = { id: '789', edit: vi.fn().mockResolvedValue(undefined) };
    const interaction = { guildId: '123456789012345678', channelId: '456', user: { id: '234567890123456789' },
      options: { getSubcommand: () => 'rps' }, deferReply: vi.fn(), editReply: vi.fn().mockResolvedValue(message) } as any;
    await handleNewGameCommand(interaction);
    expect(service.createGameSession).toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(expect.objectContaining({ components: expect.any(Array) }));
  });

  it('rejects opening a game from the wrong guild', async () => {
    vi.spyOn(service, 'getGameSession').mockResolvedValue(view());
    const interaction = { guildId: '999999999999999999', user: { id: '234567890123456789' },
      options: { getString: () => id }, deferReply: vi.fn(), deferred: true, editReply: vi.fn() } as any;
    await handleOpenGameCommand(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('server'));
  });

  it('accepts a private RPS choice without echoing it publicly', async () => {
    vi.spyOn(service, 'getGameSession').mockResolvedValue(view({ phase: 'active', opponentId: '345678901234567890' }));
    vi.spyOn(service, 'actOnGameSession').mockResolvedValue(view({ phase: 'active', opponentId: '345678901234567890',
      rps: { creatorChosen: true, opponentChosen: false, ownChoice: 'rock' }, discordMessageUrl: 'https://discord.com/channels/123456789012345678/456/789' }));
    const publicEdit = vi.fn().mockResolvedValue(undefined);
    const interaction = { customId: `game:choose:${id}:rock`, guildId: '123456789012345678',
      user: { id: '234567890123456789' }, deferReply: vi.fn(), editReply: vi.fn(),
      client: { channels: { fetch: vi.fn().mockResolvedValue({ isTextBased: () => true,
        messages: { fetch: vi.fn().mockResolvedValue({ edit: publicEdit }) } }) } } } as any;
    await handleGameButton(interaction);
    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(JSON.stringify(publicEdit.mock.calls)).not.toContain('rock');
  });
});
