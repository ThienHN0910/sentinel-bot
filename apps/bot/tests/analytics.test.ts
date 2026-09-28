import { describe, it, expect, vi, beforeEach } from 'vitest';
import { tokenizeMessage, extractMentions } from '../src/services/analytics/textParser';
import { AnalyticsService } from '../src/services/analytics/AnalyticsService';
import { generateWeeklySummary, scheduleWeeklyReports } from '../src/services/analytics/WeeklyReportCron';
import { UserStatModel } from '../src/models/UserStat';
import { WordStatModel } from '../src/models/WordStat';
import { ActivityBucketModel } from '../src/models/ActivityBucket';
import { GuildConfigModel } from '../src/models/GuildConfig';
import { ReportDeliveryModel } from '../src/models/ReportDelivery';
import cron from 'node-cron';

vi.mock('node-cron', () => ({
  default: {
    schedule: vi.fn().mockReturnValue({ stop: vi.fn(), start: vi.fn() })
  }
}));

describe('Text Parser & Stop-words Stripping', () => {
  it('tokenizes text, strips punctuation, and removes stop-words', () => {
    const text = 'Hôm nay trời rất đẹp và tôi là người chiến thắng!';
    const tokens = tokenizeMessage(text);
    expect(tokens).toContain('hôm');
    expect(tokens).toContain('đẹp');
    expect(tokens).toContain('thắng');
    expect(tokens).not.toContain('và');
    expect(tokens).not.toContain('là');
    expect(tokens).not.toContain('người');
  });

  it('strips URLs, Discord mentions, channels, and roles', () => {
    const text = 'Xem link https://example.com/xyz và hỏi <@123456789> ở kênh <#987654321> role <@&55555> nhé!';
    const tokens = tokenizeMessage(text);
    expect(tokens).not.toContain('https');
    expect(tokens).not.toContain('examplecomxyz');
    expect(tokens).not.toContain('123456789');
    expect(tokens).not.toContain('987654321');
    expect(tokens).not.toContain('55555');
    expect(tokens).toContain('xem');
    expect(tokens).toContain('link');
    expect(tokens).toContain('hỏi');
    expect(tokens).toContain('kênh');
  });

  it('strips special punctuation and filters words with length < 2', () => {
    const text = 'A! @ # $ % ^ & * ( ) _ + = ? / . , ; : hello world!';
    const tokens = tokenizeMessage(text);
    expect(tokens).toEqual(['hello', 'world']);
  });

  it('extracts Discord user mention IDs accurately', () => {
    const text = 'Chào bạn <@123456789> và <@!987654321> nhé!';
    const mentions = extractMentions(text);
    expect(mentions).toEqual(['123456789', '987654321']);
  });

  it('returns empty array if no mentions in text', () => {
    expect(extractMentions('Tin nhắn bình thường không mention ai')).toEqual([]);
  });
});

describe('AnalyticsService.handleMessage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(ActivityBucketModel, 'updateOne').mockResolvedValue({} as any);
    AnalyticsService.chatCooldowns.clear();
  });

  it('ignores messages sent by bots', async () => {
    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');
    const message = {
      author: { bot: true, id: 'bot-1' },
      guild: { id: 'g-1' }
    } as any;

    await AnalyticsService.handleMessage(message);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('ignores messages without a guild (e.g. DM)', async () => {
    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate');
    const message = {
      author: { bot: false, id: 'user-1' },
      guild: null
    } as any;

    await AnalyticsService.handleMessage(message);
    expect(updateSpy).not.toHaveBeenCalled();
  });

  it('tracks message, image count, updates user info, and awards EXP on first message', async () => {
    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);
    const bulkSpy = vi.spyOn(WordStatModel, 'bulkWrite').mockResolvedValue({} as any);

    const attachments = new Map([
      ['att-1', { contentType: 'image/png' }],
      ['att-2', { contentType: 'image/jpeg' }],
      ['att-3', { contentType: 'application/pdf' }]
    ]);

    const message = {
      guild: { id: 'g-1' },
      author: {
        id: 'u-1',
        bot: false,
        username: 'SentinelUser',
        displayAvatarURL: () => 'https://cdn.discordapp.com/avatar.png'
      },
      content: 'Chào mừng thành viên mới tham gia',
      attachments
    } as any;

    await AnalyticsService.handleMessage(message);

    expect(updateSpy).toHaveBeenCalledWith(
      { guildId: 'g-1', userId: 'u-1' },
      expect.objectContaining({
        $inc: expect.objectContaining({
          totalMessages: 1,
          totalImages: 2,
          exp: expect.any(Number)
        }),
        $set: {
          username: 'SentinelUser',
          avatar: 'https://cdn.discordapp.com/avatar.png',
          updatedAt: expect.any(Date)
        }
      }),
      { upsert: true }
    );

    const incCall = updateSpy.mock.calls[0][1] as any;
    expect(incCall.$inc.exp).toBeGreaterThanOrEqual(15);
    expect(incCall.$inc.exp).toBeLessThanOrEqual(24);
    expect(bulkSpy).toHaveBeenCalled();
  });

  it('enforces 60-second cooldown on EXP awards', async () => {
    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);
    vi.spyOn(WordStatModel, 'bulkWrite').mockResolvedValue({} as any);

    const message = {
      guild: { id: 'g-1' },
      author: {
        id: 'u-cooldown',
        bot: false,
        username: 'ActiveChatter',
        displayAvatarURL: () => 'avatar.png'
      },
      content: 'Tin nhắn thứ nhất',
      attachments: new Map()
    } as any;

    await AnalyticsService.handleMessage(message);
    const firstCall = updateSpy.mock.calls[0][1] as any;
    expect(firstCall.$inc.exp).toBeGreaterThanOrEqual(15);

    // Second message immediately within 60s
    await AnalyticsService.handleMessage(message);
    const secondCall = updateSpy.mock.calls[1][1] as any;
    expect(secondCall.$inc.exp).toBe(0);
  });

  it('increments mentionedUsers count when other users are tagged', async () => {
    const updateSpy = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);
    vi.spyOn(WordStatModel, 'bulkWrite').mockResolvedValue({} as any);

    const message = {
      guild: { id: 'g-1' },
      author: {
        id: 'u-tagger',
        bot: false,
        username: 'Tagger',
        displayAvatarURL: () => 'avatar.png'
      },
      content: 'Alo <@111111111> và <@!222222222> ơi!',
      attachments: new Map()
    } as any;

    await AnalyticsService.handleMessage(message);

    expect(updateSpy).toHaveBeenCalledWith(
      { guildId: 'g-1', userId: 'u-tagger' },
      expect.objectContaining({
        $inc: expect.objectContaining({
          totalMessages: 1,
          totalImages: 0,
          'mentionedUsers.111111111': 1,
          'mentionedUsers.222222222': 1
        })
      }),
      { upsert: true }
    );
  });

  it('upserts word frequencies to WordStatModel via bulkWrite', async () => {
    vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);
    const bulkSpy = vi.spyOn(WordStatModel, 'bulkWrite').mockResolvedValue({} as any);

    const message = {
      guild: { id: 'g-word' },
      author: {
        id: 'u-word',
        bot: false,
        username: 'Wordsmith',
        displayAvatarURL: () => 'avatar.png'
      },
      content: 'thử nghiệm phân tích dữ liệu',
      attachments: new Map()
    } as any;

    await AnalyticsService.handleMessage(message);

    expect(bulkSpy).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { guildId: 'g-word', word: 'thử' },
            update: expect.objectContaining({
              $inc: { count: 1 },
              $set: { lastSeenAt: expect.any(Date) }
            }),
            upsert: true
          })
        }),
        expect.objectContaining({
          updateOne: expect.objectContaining({
            filter: { guildId: 'g-word', word: 'nghiệm' },
            update: expect.objectContaining({
              $inc: { count: 1 },
              $set: { lastSeenAt: expect.any(Date) }
            }),
            upsert: true
          })
        })
      ])
    );
  });

  it('processes at most 50 accepted words while still counting the message', async () => {
    const userWrite = vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);
    const bulkWrite = vi.spyOn(WordStatModel, 'bulkWrite').mockResolvedValue({} as any);
    const message = {
      guild: { id: 'g-long' }, author: { id: 'u1', bot: false, username: 'Alice', displayAvatarURL: () => '' },
      content: Array.from({ length: 100 }, (_, index) => `word${index}`).join(' '), attachments: new Map()
    } as any;
    await AnalyticsService.handleMessage(message);
    expect(userWrite).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ $inc: expect.objectContaining({ totalMessages: 1 }) }), expect.any(Object));
    const operations = bulkWrite.mock.calls[0][0] as any[];
    expect(operations).toHaveLength(50);
    expect(operations.at(-1).updateOne.filter.word).toBe('word49');
  });

  it('uses one update per distinct word with the matching frequency', async () => {
    vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);
    const bulkWrite = vi.spyOn(WordStatModel, 'bulkWrite').mockResolvedValue({} as any);
    await AnalyticsService.handleMessage({
      guild: { id: 'g-repeat' }, author: { id: 'u1', bot: false, username: 'Alice', displayAvatarURL: () => '' },
      content: 'sentinel sentinel sentinel', attachments: new Map()
    } as any);
    expect(bulkWrite.mock.calls[0][0]).toEqual([
      expect.objectContaining({ updateOne: expect.objectContaining({
        filter: { guildId: 'g-repeat', word: 'sentinel' },
        update: expect.objectContaining({ $inc: { count: 3 } })
      }) })
    ]);
  });

  it('skips WordStatModel.bulkWrite when there are no valid tokens', async () => {
    vi.spyOn(UserStatModel, 'findOneAndUpdate').mockResolvedValue({} as any);
    const bulkSpy = vi.spyOn(WordStatModel, 'bulkWrite').mockResolvedValue({} as any);

    const message = {
      guild: { id: 'g-empty' },
      author: {
        id: 'u-empty',
        bot: false,
        username: 'Silent',
        displayAvatarURL: () => 'avatar.png'
      },
      content: 'là và của https://example.com !?',
      attachments: new Map()
    } as any;

    await AnalyticsService.handleMessage(message);

    expect(bulkSpy).not.toHaveBeenCalled();
  });
});

describe('WeeklyReportCron & generateWeeklySummary', () => {
  const deliveries = new Map<string, any>();
  beforeEach(() => {
    vi.restoreAllMocks();
    deliveries.clear();
    vi.spyOn(ReportDeliveryModel, 'findOneAndUpdate').mockImplementation((async (filter: any, update: any) => {
      const key = `${filter.guildId}:${filter.weekStart}`;
      const existing = deliveries.get(key);
      const now = filter.$or?.[0]?.leaseUntil?.$lte as Date;
      if (existing?.status === 'sent' || (existing?.leaseUntil && existing.leaseUntil > now)) return null;
      const record = { ...existing, guildId: filter.guildId, weekStart: filter.weekStart,
        status: 'pending', leaseUntil: update.$set.leaseUntil, leaseOwner: update.$set.leaseOwner,
        attempts: (existing?.attempts ?? 0) + 1 };
      deliveries.set(key, record);
      return record;
    }) as any);
    vi.spyOn(ReportDeliveryModel, 'updateOne').mockImplementation((async (filter: any, update: any) => {
      const key = `${filter.guildId}:${filter.weekStart}`;
      const previous = deliveries.get(key);
      if (!previous || (filter.leaseOwner && previous.leaseOwner !== filter.leaseOwner) ||
        (filter.status && previous.status !== filter.status)) return { modifiedCount: 0 };
      const next = { ...previous, ...update.$set };
      for (const field of Object.keys(update.$unset ?? {})) delete next[field];
      deliveries.set(key, next);
      return { modifiedCount: 1 };
    }) as any);
  });

  it('generates weekly summary embed and sends to configured report channels', async () => {
    vi.spyOn(GuildConfigModel, 'find').mockResolvedValue([
      { guildId: 'g-report-1', reportChannelId: 'ch-report-1' }
    ] as any);

    const mockQuery = (result: any) => ({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(result)
      })
    });

    vi.spyOn(UserStatModel, 'find')
      .mockImplementationOnce(() => mockQuery([
        { username: 'VoiceChamp', totalVoiceSeconds: 7200 }
      ]) as any)
      .mockImplementationOnce(() => mockQuery([
        { username: 'ChatChamp', totalMessages: 150 }
      ]) as any);

    vi.spyOn(WordStatModel, 'find')
      .mockImplementationOnce(() => mockQuery([
        { word: 'sentinel', count: 42 }
      ]) as any);

    const sendMock = vi.fn().mockResolvedValue({});
    const mockClient = {
      channels: {
        fetch: vi.fn().mockResolvedValue({
          send: sendMock
        })
      }
    } as any;

    await generateWeeklySummary(mockClient, new Date('2026-09-28T02:00:00.000Z'));

    expect(mockClient.channels.fetch).toHaveBeenCalledWith('ch-report-1');
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({
        embeds: [expect.any(Object)]
      })
    );

    const sentEmbed = sendMock.mock.calls[0][0].embeds[0];
    expect(sentEmbed.data.title).toBe('📊 BÁO CÁO HOẠT ĐỘNG CỘNG DỒN - SENTINEL BOT');
    expect(sentEmbed.data.title).toContain('CỘNG DỒN');
    expect(sentEmbed.data.fields).toHaveLength(2);
    expect(sentEmbed.data.fields[0].value).toContain('VoiceChamp');
    expect(sentEmbed.data.fields[1].value).toContain('ChatChamp');
    expect(JSON.stringify(sentEmbed.data)).not.toContain('sentinel');
  });

  it('falls back to "Chưa có dữ liệu" when stats lists are empty', async () => {
    vi.spyOn(GuildConfigModel, 'find').mockResolvedValue([
      { guildId: 'g-report-empty', reportChannelId: 'ch-report-2' }
    ] as any);

    const mockEmptyQuery = () => ({
      sort: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([])
      })
    });

    vi.spyOn(UserStatModel, 'find')
      .mockImplementationOnce(() => mockEmptyQuery() as any)
      .mockImplementationOnce(() => mockEmptyQuery() as any);

    vi.spyOn(WordStatModel, 'find')
      .mockImplementationOnce(() => mockEmptyQuery() as any);

    const sendMock = vi.fn().mockResolvedValue({});
    const mockClient = {
      channels: {
        fetch: vi.fn().mockResolvedValue({
          send: sendMock
        })
      }
    } as any;

    await generateWeeklySummary(mockClient, new Date('2026-09-28T02:00:00.000Z'));

    const sentEmbed = sendMock.mock.calls[0][0].embeds[0];
    expect(sentEmbed.data.fields[0].value).toBe('Chưa có dữ liệu');
    expect(sentEmbed.data.fields[1].value).toBe('Chưa có dữ liệu');
  });

  it('skips guilds with null reportChannelId or when channel fetch fails', async () => {
    vi.spyOn(GuildConfigModel, 'find').mockResolvedValue([
      { guildId: 'g-no-ch', reportChannelId: null },
      { guildId: 'g-fail-ch', reportChannelId: 'ch-invalid' }
    ] as any);

    const mockClient = {
      channels: {
        fetch: vi.fn().mockRejectedValue(new Error('Channel not found'))
      }
    } as any;

    const userFindSpy = vi.spyOn(UserStatModel, 'find');
    await generateWeeklySummary(mockClient, new Date('2026-09-28T02:00:00.000Z'));

    expect(userFindSpy).not.toHaveBeenCalled();
  });

  it('schedules hourly Monday 09:00-18:00 in Vietnam time', () => {
    const mockClient = {} as any;
    scheduleWeeklyReports(mockClient);

    expect(cron.schedule).toHaveBeenCalledWith(
      '0 9-18 * * 1',
      expect.any(Function),
      { timezone: 'Asia/Ho_Chi_Minh' }
    );
  });

  it('sends once across overlapping ticks and after a restart', async () => {
    vi.spyOn(GuildConfigModel, 'find').mockResolvedValue([{ guildId: 'g1', reportChannelId: 'c1' }] as any);
    vi.spyOn(UserStatModel, 'find').mockImplementation((() => ({ sort: () => ({ limit: async () => [] }) })) as any);
    const send = vi.fn().mockResolvedValue({});
    const client = { channels: { fetch: vi.fn().mockResolvedValue({ send }) } } as any;
    const monday = new Date('2026-09-28T02:00:00.000Z');
    await Promise.all([generateWeeklySummary(client, monday), generateWeeklySummary(client, monday)]);
    await generateWeeklySummary(client, monday);
    expect(send).toHaveBeenCalledTimes(1);
    expect([...deliveries.values()][0]).toMatchObject({ guildId: 'g1', weekStart: '2026-09-28', status: 'sent' });
  });

  it('keeps a live send leased across the next hourly tick', async () => {
    vi.useFakeTimers();
    const monday = new Date('2026-09-28T02:00:00.000Z');
    vi.setSystemTime(monday);
    try {
      vi.spyOn(GuildConfigModel, 'find').mockResolvedValue([{ guildId: 'g1', reportChannelId: 'c1' }] as any);
      vi.spyOn(UserStatModel, 'find').mockImplementation((() => ({ sort: () => ({ limit: async () => [] }) })) as any);
      let finishFirst!: () => void;
      const send = vi.fn().mockImplementationOnce(() => new Promise<void>((resolve) => { finishFirst = resolve; })).mockResolvedValue({});
      const client = { channels: { fetch: vi.fn().mockResolvedValue({ send }) } } as any;
      const first = generateWeeklySummary(client, monday);
      await vi.advanceTimersByTimeAsync(0);
      expect(send).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(16 * 60_000);
      await generateWeeklySummary(client, new Date('2026-09-28T02:16:00.000Z'));
      expect(send).toHaveBeenCalledTimes(1);
      finishFirst();
      await first;
      expect([...deliveries.values()][0].status).toBe('sent');
    } finally {
      vi.useRealTimers();
    }
  });

  it('waits until the next hour to retry a failed send', async () => {
    vi.spyOn(GuildConfigModel, 'find').mockResolvedValue([{ guildId: 'g1', reportChannelId: 'c1' }] as any);
    vi.spyOn(UserStatModel, 'find').mockImplementation((() => ({ sort: () => ({ limit: async () => [] }) })) as any);
    const send = vi.fn().mockRejectedValueOnce(new Error('Discord unavailable')).mockResolvedValue({});
    const client = { channels: { fetch: vi.fn().mockResolvedValue({ send }) } } as any;
    await generateWeeklySummary(client, new Date('2026-09-28T02:00:00.000Z'));
    await generateWeeklySummary(client, new Date('2026-09-28T02:30:00.000Z'));
    expect(send).toHaveBeenCalledTimes(1);
    await generateWeeklySummary(client, new Date('2026-09-28T03:00:00.000Z'));
    expect(send).toHaveBeenCalledTimes(2);
    expect([...deliveries.values()][0].status).toBe('sent');
  });

  it('skips dates outside the Monday window and guilds without a report channel', async () => {
    const configs = vi.spyOn(GuildConfigModel, 'find').mockResolvedValue([{ guildId: 'g1', reportChannelId: null }] as any);
    const send = vi.fn();
    const client = { channels: { fetch: vi.fn().mockResolvedValue({ send }) } } as any;
    await generateWeeklySummary(client, new Date('2026-09-27T02:00:00.000Z'));
    await generateWeeklySummary(client, new Date('2026-09-28T11:01:00.000Z'));
    expect(configs).not.toHaveBeenCalled();
    await generateWeeklySummary(client, new Date('2026-09-28T02:00:00.000Z'));
    expect(send).not.toHaveBeenCalled();
  });
});
