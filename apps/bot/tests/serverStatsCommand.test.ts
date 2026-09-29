import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction, Guild } from 'discord.js';
import * as analytics from '../src/services/analytics';
import * as commands from '../src/commands';
import { UserStatModel } from '../src/models/UserStat';
import { VoiceSessionModel } from '../src/models/VoiceSession';
import { slashCommands } from '../src/events/ready';

const getServerStats = (analytics as unknown as {
  getServerStats: (guild: Guild, now?: Date) => Promise<unknown>
}).getServerStats;
const handleServerStatsCommand = (commands as unknown as {
  handleServerStatsCommand: (interaction: ChatInputCommandInteraction) => Promise<void>
}).handleServerStatsCommand;

const now = new Date('2026-09-29T02:00:00Z');
function guild(id = 'guild-1') {
  return { id, name: 'Test Server', memberCount: 42,
    voiceStates: { cache: new Map([['user-1', {}]]) }
  } as unknown as Guild;
}

describe('/serverstats', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('registers a top-level guild command', () => {
    expect(slashCommands.some((command) => command.name === 'serverstats')).toBe(true);
  });

  it('keeps cumulative messages and completed versus active voice separate', async () => {
    vi.spyOn(UserStatModel, 'aggregate').mockResolvedValue([{ totalMessages: 100, totalVoiceSeconds: 3600 }]);
    vi.spyOn(VoiceSessionModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([
      { guildId: 'guild-1', userId: 'user-1', startedAt: new Date('2026-09-29T01:50:00Z') }
    ]) } as never);
    expect(await getServerStats(guild(), now)).toMatchObject({
      members: 42, messages: 100, voiceCompletedSeconds: 3600,
      voiceActiveEstimatedSeconds: 600
    });
  });

  it('uses a separate 30-second cache entry for each guild', async () => {
    const aggregate = vi.spyOn(UserStatModel, 'aggregate').mockResolvedValue([{ totalMessages: 4, totalVoiceSeconds: 0 }]);
    vi.spyOn(VoiceSessionModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([]) } as never);
    await getServerStats(guild('g-cache-a'), now);
    await getServerStats(guild('g-cache-a'), new Date(now.getTime() + 10_000));
    await getServerStats(guild('g-cache-b'), now);
    expect(aggregate).toHaveBeenCalledTimes(2);
  });

  it('reports a database failure instead of fabricated zeros', async () => {
    vi.spyOn(UserStatModel, 'aggregate').mockRejectedValue(new Error('db down'));
    vi.spyOn(VoiceSessionModel, 'find').mockReturnValue({ lean: vi.fn().mockResolvedValue([]) } as never);
    const interaction = {
      guildId: 'g-failure', guild: guild('g-failure'),
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined)
    } as unknown as ChatInputCommandInteraction;
    await handleServerStatsCommand(interaction);
    expect(interaction.editReply).toHaveBeenCalledWith(expect.stringContaining('không tải được'));
  });
});
