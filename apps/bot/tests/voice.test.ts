import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';
import { PassThrough, Readable } from 'stream';
import { calculateVoiceRewards, VoiceService, activeVoiceSessions, pendingVoiceEvents } from '../src/services/voice/VoiceService';
import { getVietnameseTtsStream } from '../src/services/voice/ttsStream';
import { GuildConfigModel } from '../src/models/GuildConfig';
import { UserStatModel } from '../src/models/UserStat';
import { ActivityBucketModel } from '../src/models/ActivityBucket';
import { VoiceSessionModel } from '../src/models/VoiceSession';
import * as discordVoice from '@discordjs/voice';
import https from 'https';

vi.mock('@discordjs/voice', () => {
  return {
    joinVoiceChannel: vi.fn(),
    createAudioPlayer: vi.fn(),
    createAudioResource: vi.fn(),
    AudioPlayerStatus: {
      Idle: 'idle',
      Playing: 'playing',
      Buffering: 'buffering',
      Paused: 'paused',
      AutoPaused: 'autopaused'
    },
    VoiceConnectionStatus: {
      Signalling: 'signalling',
      Connecting: 'connecting',
      Ready: 'ready'
    }
  };
});

describe('Voice Rewards Math', () => {
  it('awards 10 EXP and 5 Coins per 300 seconds (5 mins)', () => {
    const rewards = calculateVoiceRewards(600); // 10 minutes
    expect(rewards.exp).toBe(20);
    expect(rewards.coins).toBe(10);
  });

  it('awards 0 if duration is under 5 minutes', () => {
    const rewards = calculateVoiceRewards(150);
    expect(rewards.exp).toBe(0);
    expect(rewards.coins).toBe(0);
  });

  it('ignores fractional intervals below 300 seconds', () => {
    const rewards = calculateVoiceRewards(750); // 12.5 minutes => 2 intervals
    expect(rewards.exp).toBe(20);
    expect(rewards.coins).toBe(10);
  });
});

describe('getVietnameseTtsStream', () => {
  it('streams audio chunks from Google TTS URL', async () => {
    const fakeIncoming = new PassThrough();
    const httpsGetSpy = vi.spyOn(https, 'get').mockImplementation((url: any, cb: any) => {
      expect(url).toContain('https://translate.google.com/translate_tts');
      expect(url).toContain('tl=vi');
      expect(url).toContain(encodeURIComponent('Xin chào'));
      if (typeof cb === 'function') {
        cb(fakeIncoming as any);
      }
      return {
        on: vi.fn().mockReturnThis()
      } as any;
    });

    const stream = getVietnameseTtsStream('Xin chào');
    const chunks: Buffer[] = [];
    stream.on('data', (c) => chunks.push(c));

    fakeIncoming.write(Buffer.from('mp3-chunk-1'));
    fakeIncoming.write(Buffer.from('mp3-chunk-2'));
    fakeIncoming.end();

    await new Promise((resolve) => stream.on('end', resolve));
    expect(Buffer.concat(chunks).toString()).toBe('mp3-chunk-1mp3-chunk-2');
    httpsGetSpy.mockRestore();
  });

  it('destroys readable stream if https request encounters an error', async () => {
    const emitter = new EventEmitter();
    const httpsGetSpy = vi.spyOn(https, 'get').mockImplementation(() => {
      return {
        on: (event: string, handler: (err: any) => void) => {
          if (event === 'error') {
            process.nextTick(() => handler(new Error('Network error')));
          }
          return emitter;
        }
      } as any;
    });

    const stream = getVietnameseTtsStream('Error test');
    await expect(
      new Promise((_, reject) => {
        stream.on('error', reject);
      })
    ).rejects.toThrow('Network error');

    httpsGetSpy.mockRestore();
  });
});

describe('VoiceService.handleVoiceStateUpdate', () => {
  beforeEach(() => {
    activeVoiceSessions.clear();
    pendingVoiceEvents.clear();
    vi.restoreAllMocks();
    vi.spyOn(ActivityBucketModel, 'updateOne').mockResolvedValue({} as any);
    vi.spyOn(VoiceSessionModel, 'findOneAndUpdate').mockResolvedValue({} as any);
    vi.spyOn(VoiceSessionModel, 'findOne').mockResolvedValue(null);
    vi.spyOn(VoiceService, 'settleSession').mockImplementation(async (guildId, userId) => {
      activeVoiceSessions.delete(`${guildId}:${userId}`);
    });
  });

  it('ignores updates triggered by bot users', async () => {
    const findOneSpy = vi.spyOn(GuildConfigModel, 'findOne');
    const oldState = { channelId: null, id: 'bot-1', guild: { id: 'g-1' } } as any;
    const newState = {
      channelId: 'vc-1',
      id: 'bot-1',
      guild: { id: 'g-1' },
      member: { user: { bot: true } }
    } as any;

    await VoiceService.handleVoiceStateUpdate(oldState, newState);
    expect(activeVoiceSessions.size).toBe(0);
    expect(findOneSpy).not.toHaveBeenCalled();
  });

  it('records session and triggers TTS greeting when user joins a voice channel with TTS enabled', async () => {
    const playGreetingSpy = vi.spyOn(VoiceService, 'playGreeting').mockResolvedValue(undefined as any);
    vi.spyOn(GuildConfigModel, 'findOne').mockResolvedValue({
      welcomeVoiceTts: true,
      welcomeMessage: 'Chào mừng {user} đã đến với chúng tôi!'
    } as any);

    const oldState = { channelId: null, id: 'user-1', guild: { id: 'g-1' } } as any;
    const newState = {
      channelId: 'vc-100',
      id: 'user-1',
      guild: { id: 'g-1' },
      member: {
        displayName: 'Minh',
        user: { bot: false, username: 'minh123', displayAvatarURL: () => 'avatar.png' }
      }
    } as any;

    await VoiceService.handleVoiceStateUpdate(oldState, newState);

    expect(activeVoiceSessions.has('g-1:user-1')).toBe(true);
    expect(playGreetingSpy).toHaveBeenCalledWith(
      newState,
      'Chào mừng Minh đã đến với chúng tôi!'
    );
  });

  it('does not trigger TTS greeting if welcomeVoiceTts is disabled in config', async () => {
    const playGreetingSpy = vi.spyOn(VoiceService, 'playGreeting').mockResolvedValue(undefined as any);
    vi.spyOn(GuildConfigModel, 'findOne').mockResolvedValue({
      welcomeVoiceTts: false,
      welcomeMessage: 'Chào mừng {user}'
    } as any);

    const oldState = { channelId: null, id: 'user-2', guild: { id: 'g-1' } } as any;
    const newState = {
      channelId: 'vc-100',
      id: 'user-2',
      guild: { id: 'g-1' },
      member: {
        displayName: 'Lan',
        user: { bot: false }
      }
    } as any;

    await VoiceService.handleVoiceStateUpdate(oldState, newState);

    expect(activeVoiceSessions.has('g-1:user-2')).toBe(true);
    expect(playGreetingSpy).not.toHaveBeenCalled();
  });

  it('delegates a leave to durable session settlement with user identity', async () => {
    const settleSpy = vi.spyOn(VoiceService, 'settleSession');
    const sessionKey = 'g-1:user-3';
    // Simulate joined 600 seconds (10 mins) ago
    activeVoiceSessions.set(sessionKey, Date.now() - 600 * 1000);

    const oldState = {
      channelId: 'vc-100',
      id: 'user-3',
      guild: { id: 'g-1' },
      member: {
        user: {
          bot: false,
          username: 'User3',
          displayAvatarURL: () => 'https://cdn.discordapp.com/user3.png'
        }
      }
    } as any;
    const newState = {
      channelId: null,
      id: 'user-3',
      guild: { id: 'g-1' },
      member: {
        user: { bot: false }
      }
    } as any;

    await VoiceService.handleVoiceStateUpdate(oldState, newState);

    expect(activeVoiceSessions.has(sessionKey)).toBe(false);
    expect(settleSpy).toHaveBeenCalledWith('g-1', 'user-3', expect.any(Date), {
      username: 'User3', avatar: 'https://cdn.discordapp.com/user3.png'
    });
  });

  it('checks durable storage when an unknown in-memory user leaves voice', async () => {
    const settleSpy = vi.spyOn(VoiceService, 'settleSession');
    const oldState = { channelId: 'vc-100', id: 'user-unknown', guild: { id: 'g-1' } } as any;
    const newState = { channelId: null, id: 'user-unknown', guild: { id: 'g-1' } } as any;

    await VoiceService.handleVoiceStateUpdate(oldState, newState);
    expect(settleSpy).toHaveBeenCalledWith('g-1', 'user-unknown', expect.any(Date), expect.any(Object));
  });
});

describe('VoiceService.playGreeting', () => {
  let mockConnection: any;
  let mockPlayer: any;
  let playerListeners: { [event: string]: Function };

  beforeEach(() => {
    playerListeners = {};
    mockConnection = {
      subscribe: vi.fn(),
      destroy: vi.fn()
    };
    mockPlayer = {
      play: vi.fn(),
      stop: vi.fn(),
      on: vi.fn((event: string, handler: Function) => {
        playerListeners[event] = handler;
        return mockPlayer;
      })
    };

    vi.mocked(discordVoice.joinVoiceChannel).mockReturnValue(mockConnection);
    vi.mocked(discordVoice.createAudioPlayer).mockReturnValue(mockPlayer);
    vi.mocked(discordVoice.createAudioResource).mockReturnValue({} as any);
  });

  it('returns early if state channel is null', async () => {
    const state = { channel: null } as any;
    await VoiceService.playGreeting(state, 'Hello');
    expect(discordVoice.joinVoiceChannel).not.toHaveBeenCalled();
  });

  it('joins voice channel, plays audio stream, and disconnects upon Idle', async () => {
    const state = {
      channel: { id: 'vc-channel-1' },
      guild: { id: 'g-1', voiceAdapterCreator: {} }
    } as any;

    await VoiceService.playGreeting(state, 'Xin chào');

    expect(discordVoice.joinVoiceChannel).toHaveBeenCalledWith({
      channelId: 'vc-channel-1',
      guildId: 'g-1',
      adapterCreator: state.guild.voiceAdapterCreator
    });
    expect(mockPlayer.play).toHaveBeenCalled();
    expect(mockConnection.subscribe).toHaveBeenCalledWith(mockPlayer);

    // Simulate audio finishing and entering Idle
    expect(playerListeners['idle']).toBeDefined();
    playerListeners['idle']();

    expect(mockPlayer.stop).toHaveBeenCalled();
    expect(mockConnection.destroy).toHaveBeenCalled();
  });

  it('destroys voice connection upon player error', async () => {
    const state = {
      channel: { id: 'vc-channel-1' },
      guild: { id: 'g-1', voiceAdapterCreator: {} }
    } as any;

    await VoiceService.playGreeting(state, 'Xin chào');

    expect(playerListeners['error']).toBeDefined();
    playerListeners['error'](new Error('Audio playback failed'));

    expect(mockConnection.destroy).toHaveBeenCalled();
  });
});
