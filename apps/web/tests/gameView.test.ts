// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia } from 'pinia';

vi.mock('../src/seo', () => ({ usePageSeo: vi.fn() }));
const id = 'abcdefghijklmnopqrstu';
const session = (part = {}) => ({ sessionId: id, guildId: '123456789012345678', kind: 'tictactoe',
  creatorId: '234567890123456789', opponentId: '345678901234567890', phase: 'active',
  expiresAt: new Date(Date.now() + 100000).toISOString(), board: Array(9).fill(null),
  turnId: '234567890123456789', ...part });

async function mountGame(path: string, fetcher: ReturnType<typeof vi.fn>) {
  vi.stubGlobal('fetch', fetcher);
  const { default: GameView } = await import('../src/views/GameView.vue');
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/games/new', component: GameView }, { path: '/games/:sessionId', component: GameView }
  ] });
  await router.push(path); await router.isReady();
  const wrapper = mount(GameView, { global: { plugins: [router, createPinia()] } });
  await flushPromises();
  return wrapper;
}

describe('shared web games', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.clearAllTimers(); vi.useRealTimers(); });

  it('keeps the current game URL through Discord login', async () => {
    const fetcher = vi.fn(async () => new Response('{}', { status: 401 }));
    const wrapper = await mountGame(`/games/${id}`, fetcher);
    expect(wrapper.get('a[href*="/api/auth/discord/start"]').attributes('href')).toContain(`return_to=%2Fgames%2F${id}`);
    wrapper.unmount();
  });

  it('submits a move with credentials and CSRF', async () => {
    const fetcher = vi.fn(async (input: string, options?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return new Response(JSON.stringify({ user: { id: '234567890123456789', username: 'A', avatar: null }, csrfToken: 'secret' }));
      if (options?.method === 'POST') return new Response(JSON.stringify(session({ board: ['X', ...Array(8).fill(null)] })));
      return new Response(JSON.stringify(session()));
    });
    const wrapper = await mountGame(`/games/${id}`, fetcher);
    await wrapper.get('[aria-label="Đánh ô 1"]').trigger('click');
    await flushPromises();
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(`/api/games/${id}/actions`),
      expect.objectContaining({ credentials: 'include', method: 'POST', headers: expect.objectContaining({ 'x-csrf-token': 'secret' }) }));
    wrapper.unmount();
  });

  it('shows no controls to spectators and hides unrevealed RPS choices', async () => {
    const fetcher = vi.fn(async (input: string) => String(input).endsWith('/api/auth/me') ?
      new Response(JSON.stringify({ user: { id: '999999999999999999', username: 'Guest', avatar: null }, csrfToken: 'secret' })) :
      new Response(JSON.stringify(session({ kind: 'rps', board: undefined, turnId: undefined,
        rps: { creatorChosen: true, opponentChosen: false } }))));
    const wrapper = await mountGame(`/games/${id}`, fetcher);
    expect(wrapper.text()).toContain('đã chọn');
    expect(wrapper.find('button[aria-label="Chọn búa"]').exists()).toBe(false);
    wrapper.unmount();
  });

  it('allows creation after selecting a served guild', async () => {
    const fetcher = vi.fn(async (input: string, options?: RequestInit) => {
      const url = String(input);
      if (url.endsWith('/api/auth/me')) return new Response(JSON.stringify({ user: { id: '234567890123456789', username: 'A', avatar: null }, csrfToken: 'secret' }));
      if (url.endsWith('/api/guilds')) return new Response(JSON.stringify({ guilds: [{ id: '123456789012345678', name: 'Test Guild' }] }));
      if (options?.method === 'POST') return new Response(JSON.stringify(session({ phase: 'waiting', opponentId: null })), { status: 201 });
      return new Response('{}');
    });
    const wrapper = await mountGame('/games/new', fetcher);
    expect(wrapper.find('select[aria-label="Chọn server"]').exists()).toBe(true);
    await wrapper.get('button[aria-label="Tạo ván cờ 3×3"]').trigger('click');
    await flushPromises();
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/api/games'), expect.objectContaining({ method: 'POST' }));
    wrapper.unmount();
  });
});
