// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import * as api from '../src/api';

vi.mock('../src/seo', () => ({ usePageSeo: vi.fn() }));

const page = (userId: string, nextCursor: string | null = null) => ({
  rows: [{ rank: 1, userId, username: userId, avatar: '', score: 282, level: 2 }],
  nextCursor, generatedAt: '2026-09-28T00:00:00.000Z'
});

async function mountRankings() {
  const { default: RankingsView } = await import('../src/views/RankingsView.vue');
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/dashboard/rankings', component: RankingsView }] });
  await router.push('/dashboard/rankings');
  await router.isReady();
  const wrapper = mount(RankingsView, { global: { plugins: [router] } });
  await flushPromises();
  return wrapper;
}

describe('public rankings page', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('encodes the guild, metric, and cursor in the ranking request', async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL) => new Response(JSON.stringify(page('u1')), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await (api as any).getRankingPage('guild 1', 'voice', 'a+/=');
    expect(fetcher.mock.calls[0][0]).toContain('/api/guilds/guild%201/rankings?metric=voice&cursor=a%2B%2F%3D');
  });

  it('moves forward and back with cursors, then clears the page on a tab or guild change', async () => {
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      requests.push(input);
      if (input.endsWith('/api/guilds')) return new Response(JSON.stringify({ guilds: [
        { id: 'g1', name: 'Guild One' }, { id: 'g2', name: 'Guild Two' }
      ] }), { status: 200 });
      const url = new URL(input);
      const cursor = url.searchParams.get('cursor');
      return new Response(JSON.stringify(cursor ? page('second') : page('first', 'next')), { status: 200 });
    }));
    const wrapper = await mountRankings();
    expect(wrapper.text()).toContain('first');
    await wrapper.get('button[aria-label="Trang tiếp"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('second');
    expect(requests.some((url) => url.includes('cursor=next'))).toBe(true);
    await wrapper.get('button[aria-label="Trang trước"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('first');
    await wrapper.get('button[aria-label="Voice"]').trigger('click');
    await flushPromises();
    expect(requests.at(-1)).toContain('metric=voice');
    expect(requests.at(-1)).not.toContain('cursor=');
    expect(wrapper.text()).toContain('đã lưu');
    await wrapper.get('button[aria-label="Cấp độ"]').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('XP');
    expect(wrapper.text()).toContain('Cấp 2');
    await wrapper.get('select').setValue('g2');
    await flushPromises();
    expect(requests.at(-1)).toContain('/api/guilds/g2/rankings?metric=level');
    expect(requests.at(-1)).not.toContain('cursor=');
  });
});
