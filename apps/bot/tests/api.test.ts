import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { buildFastifyServer } from '../src/api/server';
import { UserStatModel, WordStatModel, WheelSessionModel } from '../src/models';
import { registerWheelClient, broadcastWheelEvent } from '../src/api/websocket/wheelSocket';
import { WebSocket } from 'ws';

describe('Fastify REST API & WebSocket Hub', () => {
  let app: ReturnType<typeof buildFastifyServer>;

  beforeAll(async () => {
    app = buildFastifyServer();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /api/health returns status ok with telemetry', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/health'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.status).toBe('ok');
    expect(body).toHaveProperty('uptime');
    expect(body).toHaveProperty('memory');
    expect(body.memory).toHaveProperty('rssMb');
    expect(body.memory).toHaveProperty('heapUsedMb');
    expect(body).toHaveProperty('telemetry');
    expect(body.telemetry).toHaveProperty('busyMs');
  });

  it('GET /api/guilds/:guildId/leaderboard returns topVoice, topChat, and topLevel', async () => {
    const mockLean = vi.fn().mockResolvedValue([{ userId: 'u1', exp: 100 }]);
    const mockLimit = vi.fn().mockReturnValue({ lean: mockLean });
    const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
    vi.spyOn(UserStatModel, 'find').mockReturnValue({ sort: mockSort } as any);

    const res = await app.inject({
      method: 'GET',
      url: '/api/guilds/12345/leaderboard'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('topVoice');
    expect(body).toHaveProperty('topChat');
    expect(body).toHaveProperty('topLevel');
    expect(UserStatModel.find).toHaveBeenCalledWith({ guildId: '12345' });
  });

  it('GET /api/guilds/:guildId/wordcloud returns words for guild', async () => {
    const mockWords = [{ word: 'sentinel', count: 42 }];
    const mockLean = vi.fn().mockResolvedValue(mockWords);
    const mockLimit = vi.fn().mockReturnValue({ lean: mockLean });
    const mockSort = vi.fn().mockReturnValue({ limit: mockLimit });
    vi.spyOn(WordStatModel, 'find').mockReturnValue({ sort: mockSort } as any);

    const res = await app.inject({
      method: 'GET',
      url: '/api/guilds/12345/wordcloud'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body).toHaveProperty('words');
    expect(body.words).toEqual(mockWords);
    expect(WordStatModel.find).toHaveBeenCalledWith({ guildId: '12345' });
  });

  it('GET /api/wheel/:sessionId returns 404 when session not found', async () => {
    vi.spyOn(WheelSessionModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(null)
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: '/api/wheel/non-existent'
    });

    expect(res.statusCode).toBe(404);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Session not found');
  });

  it('GET /api/wheel/:sessionId returns session when found', async () => {
    const mockSession = {
      sessionId: 'sess-1',
      guildId: 'g1',
      title: 'Vòng quay',
      items: [{ id: '1', label: 'Item 1', color: '#fff' }]
    };
    vi.spyOn(WheelSessionModel, 'findOne').mockReturnValue({
      lean: vi.fn().mockResolvedValue(mockSession)
    } as any);

    const res = await app.inject({
      method: 'GET',
      url: '/api/wheel/sess-1'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(body.sessionId).toBe('sess-1');
  });

  it('POST /api/wheel/:sessionId/spin returns 400 when session is invalid or has empty items', async () => {
    vi.spyOn(WheelSessionModel, 'findOne').mockResolvedValue(null as any);

    const res = await app.inject({
      method: 'POST',
      url: '/api/wheel/empty-sess/spin'
    });

    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.payload);
    expect(body.error).toBe('Invalid session or empty items');
  });

  it('POST /api/wheel/:sessionId/spin calculates winner, targetIndex, and duration', async () => {
    vi.useFakeTimers();
    const mockSession = {
      sessionId: 'sess-spin',
      items: [
        { id: '1', label: 'Prize A', color: '#f00' },
        { id: '2', label: 'Prize B', color: '#0f0' }
      ],
      winner: undefined as string | undefined,
      isCompleted: false,
      save: vi.fn().mockResolvedValue(true)
    };
    vi.spyOn(WheelSessionModel, 'findOne').mockResolvedValue(mockSession as any);

    const res = await app.inject({
      method: 'POST',
      url: '/api/wheel/sess-spin/spin'
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.payload);
    expect(['Prize A', 'Prize B']).toContain(body.winner);
    expect(typeof body.targetIndex).toBe('number');
    expect(body.durationMs).toBe(6000);
    expect(mockSession.isCompleted).toBe(true);
    expect(mockSession.save).toHaveBeenCalled();

    // Advance timers for SPIN_END event
    vi.runAllTimers();
    vi.useRealTimers();
  });

  it('does not change the result of an already completed wheel', async () => {
    const existing = {
      sessionId: 'completed',
      items: [{ id: '1', label: 'A', color: '#fff' }],
      winner: 'A',
      isCompleted: true,
      save: vi.fn()
    };
    vi.spyOn(WheelSessionModel, 'findOne').mockResolvedValue(existing as any);
    const res = await app.inject({ method: 'POST', url: '/api/wheel/completed/spin' });
    expect(res.statusCode).toBe(409);
    expect(existing.save).not.toHaveBeenCalled();
    expect(existing.winner).toBe('A');
  });

  it('manages WebSocket client registration, broadcasting, and clean disconnect', () => {
    const sessionId = 'test-room-1';
    let closeListener: (() => void) | undefined;

    const mockWsOpen = {
      readyState: WebSocket.OPEN,
      send: vi.fn(),
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'close') closeListener = cb;
      })
    } as unknown as WebSocket;

    const mockWsClosed = {
      readyState: WebSocket.CLOSED,
      send: vi.fn(),
      on: vi.fn()
    } as unknown as WebSocket;

    registerWheelClient(sessionId, mockWsOpen);
    registerWheelClient(sessionId, mockWsClosed);

    broadcastWheelEvent(sessionId, { event: 'SPIN_START', targetIndex: 0 });

    expect((mockWsOpen.send as any)).toHaveBeenCalledWith(
      JSON.stringify({ event: 'SPIN_START', targetIndex: 0 })
    );
    expect((mockWsClosed.send as any)).not.toHaveBeenCalled();

    // Trigger disconnect
    expect(closeListener).toBeDefined();
    closeListener!();

    // Broadcasting again should only affect remaining clients
    (mockWsOpen.send as any).mockClear();
    broadcastWheelEvent(sessionId, { event: 'TEST' });
    expect((mockWsOpen.send as any)).not.toHaveBeenCalled();
  });
});
