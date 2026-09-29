import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ChatInputCommandInteraction } from 'discord.js';
import { ReminderService } from '../src/services/reminder/ReminderService';
import * as commands from '../src/commands';
import { slashCommands } from '../src/events/ready';

const handleRemindCommand = (commands as unknown as {
  handleRemindCommand: (interaction: ChatInputCommandInteraction) => Promise<void>
}).handleRemindCommand;

function interaction(subcommand: string, values: Record<string, string> = {}) {
  return {
    guildId: 'guild-1', user: { id: 'user-1' },
    options: { getSubcommand: () => subcommand, getString: (key: string) => values[key] },
    deferReply: vi.fn().mockResolvedValue(undefined),
    editReply: vi.fn().mockResolvedValue(undefined),
    reply: vi.fn().mockResolvedValue(undefined)
  } as unknown as ChatInputCommandInteraction;
}

describe('/remind', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('registers set, list and cancel subcommands', () => {
    const command = slashCommands.find((item) => item.name === 'remind');
    expect(command?.options?.map((option) => option.name)).toEqual(['set', 'list', 'cancel']);
  });

  it('creates a one-minute reminder privately and explains closed DMs', async () => {
    vi.spyOn(ReminderService, 'createReminder').mockResolvedValue({
      publicId: 'reminder0001', remindAt: new Date('2026-09-29T02:00:00Z')
    } as never);
    const input = interaction('set', { in: '1m', text: 'Họp team' });
    await handleRemindCommand(input);
    expect(input.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(ReminderService.createReminder).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'user-1', guildId: 'guild-1', message: 'Họp team'
    }));
    expect(input.editReply).toHaveBeenCalledWith(expect.stringContaining('DM'));
  });

  it.each(['0m', '8d', '1w', '999999999999999999d'])('rejects invalid delay %s', async (value) => {
    const create = vi.spyOn(ReminderService, 'createReminder');
    const input = interaction('set', { in: value, text: 'Họp team' });
    await handleRemindCommand(input);
    expect(create).not.toHaveBeenCalled();
    expect(input.editReply).toHaveBeenCalledWith(expect.stringContaining('thời gian'));
  });

  it('rejects a 201-character message before storage', async () => {
    const create = vi.spyOn(ReminderService, 'createReminder');
    const input = interaction('set', { in: '10m', text: 'x'.repeat(201) });
    await handleRemindCommand(input);
    expect(create).not.toHaveBeenCalled();
    expect(input.editReply).toHaveBeenCalledWith(expect.stringContaining('200'));
  });

  it('lists pending and failed reminders privately', async () => {
    vi.spyOn(ReminderService, 'listReminders').mockResolvedValue({
      pending: [{ publicId: 'reminder0001', message: 'Họp team', remindAt: new Date('2026-09-29T02:00:00Z') }],
      failed: [{ publicId: 'reminder0002', message: 'Đọc sách', remindAt: new Date('2026-09-28T02:00:00Z') }]
    } as never);
    const input = interaction('list');
    await handleRemindCommand(input);
    expect(input.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(input.editReply).toHaveBeenCalledWith(expect.stringContaining('reminder0001'));
    expect(input.editReply).toHaveBeenCalledWith(expect.stringContaining('reminder0002'));
  });

  it('keeps a full reminder list within Discord message limits', async () => {
    vi.spyOn(ReminderService, 'listReminders').mockResolvedValue({
      pending: Array.from({ length: 10 }, (_, index) => ({
        publicId: `reminder${String(index).padStart(4, '0')}`,
        message: 'x'.repeat(200), remindAt: new Date('2026-09-29T02:00:00Z')
      })),
      failed: Array.from({ length: 5 }, (_, index) => ({
        publicId: `failed00${String(index).padStart(4, '0')}`,
        message: 'y'.repeat(200), remindAt: new Date('2026-09-29T02:00:00Z')
      }))
    } as never);
    const input = interaction('list');
    await handleRemindCommand(input);
    const message = vi.mocked(input.editReply).mock.calls[0][0];
    expect(String(message).length).toBeLessThanOrEqual(2000);
  });

  it('does not cancel another user reminder', async () => {
    vi.spyOn(ReminderService, 'cancelReminder').mockResolvedValue(false);
    const input = interaction('cancel', { id: 'reminder0001' });
    await handleRemindCommand(input);
    expect(ReminderService.cancelReminder).toHaveBeenCalledWith('user-1', 'reminder0001');
    expect(input.editReply).toHaveBeenCalledWith(expect.stringMatching(/không tìm thấy/i));
  });
});
