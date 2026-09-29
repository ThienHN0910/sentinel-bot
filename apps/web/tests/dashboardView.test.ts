// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createMemoryHistory, createRouter } from 'vue-router';
import { createPinia } from 'pinia';

vi.mock('../src/seo', () => ({ usePageSeo: vi.fn() }));

async function mountDashboard(query: string) {
  const { default: DashboardView } = await import('../src/views/DashboardView.vue');
  const router = createRouter({ history: createMemoryHistory(), routes: [
    { path: '/dashboard', component: DashboardView },
    { path: '/dashboard/rankings', component: { template: '<div />' } }
  ] });
  await router.push(`/dashboard${query}`);
  await router.isReady();
  const wrapper = mount(DashboardView, { global: { plugins: [router, createPinia()] } });
  await flushPromises();
  return wrapper;
}

describe('dashboard guild deep link', () => {
  afterEach(() => { localStorage.clear(); vi.unstubAllGlobals(); });

  it.each([
    ['?guild=g2', 'g2'],
    ['?guild=unknown', 'g1']
  ])('selects a valid query guild for %s', async (query, expected) => {
    localStorage.setItem('sentinel.guildId', 'g1');
    const requests: string[] = [];
    vi.stubGlobal('fetch', vi.fn(async (input: string) => {
      requests.push(String(input));
      if (String(input).endsWith('/api/guilds')) return new Response(JSON.stringify({ guilds: [
        { id: 'g1', name: 'One' }, { id: 'g2', name: 'Two' }
      ] }), { status: 200 });
      return new Response(JSON.stringify({ guild: { id: expected, name: 'Test' },
        stats: { members: 0, voiceNow: 0, messages: 0, voiceCompletedSeconds: 0,
          voiceActiveEstimatedSeconds: 0, voiceTotalEstimatedSeconds: 0 },
        podium: [], topVoice: [], words: [], activity: { days: [], matrix: [], messagesMatrix: [], voiceJoinsMatrix: [] },
        updatedAt: new Date().toISOString() }), { status: 200 });
    }));
    const wrapper = await mountDashboard(query);
    expect(requests.some((url) => url.includes(`/api/guilds/${expected}/dashboard`))).toBe(true);
    wrapper.unmount();
  });
});
