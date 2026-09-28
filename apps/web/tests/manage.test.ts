// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { createMemoryHistory, createRouter } from 'vue-router';
import * as api from '../src/api';

vi.mock('../src/seo', () => ({ usePageSeo: vi.fn() }));

async function mountManage() {
  const { default: ManageView } = await import('../src/views/ManageView.vue');
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/dashboard/manage', component: ManageView }] });
  await router.push('/dashboard/manage');
  await router.isReady();
  const wrapper = mount(ManageView, { global: { plugins: [router, createPinia()] } });
  await flushPromises();
  return wrapper;
}

const settings = { welcomeVoiceTts: true, welcomeMessage: 'Chào {user}', reportChannelId: null,
  channels: [{ id: 'channel-1', name: 'reports' }] };

function fakeApi(options: { loggedIn?: boolean; saveStatus?: number } = {}) {
  const calls: { url: string; init?: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, init });
    if (url.endsWith('/api/auth/me')) return new Response(options.loggedIn ? JSON.stringify({
      user: { id: 'u1', username: 'Alice', avatar: null }, csrfToken: 'csrf-1'
    }) : JSON.stringify({ error: 'Login required' }), { status: options.loggedIn ? 200 : 401 });
    if (url.endsWith('/api/admin/guilds')) return new Response(JSON.stringify({ guilds: [{ id: 'guild-1', name: 'Guild One' }] }), { status: 200 });
    if (url.endsWith('/api/admin/guilds/guild-1/settings') && init?.method === 'PATCH') {
      if (options.saveStatus) return new Response(JSON.stringify({ error: 'Manage Server permission required' }), { status: options.saveStatus });
      return new Response(JSON.stringify({ ...settings, ...JSON.parse(String(init.body)) }), { status: 200 });
    }
    if (url.endsWith('/api/admin/guilds/guild-1/settings')) return new Response(JSON.stringify(settings), { status: 200 });
    throw new Error(`Unexpected request ${url}`);
  }));
  return calls;
}

describe('server management client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses credentialed API requests and sends CSRF for settings writes', async () => {
    const fetcher = vi.fn(async (_url: RequestInfo | URL, _options?: RequestInit) => new Response(JSON.stringify({
      user: { id: 'u1', username: 'Alice' }, csrfToken: 'csrf-1'
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await (api as any).getAuthMe();
    expect(fetcher.mock.calls[0][1]).toMatchObject({ credentials: 'include' });
    await (api as any).patchGuildSettings('guild 1', { welcomeVoiceTts: false }, 'csrf-1');
    expect(fetcher.mock.calls[1][0]).toContain('/api/admin/guilds/guild%201/settings');
    expect(fetcher.mock.calls[1][1]).toMatchObject({
      method: 'PATCH', credentials: 'include',
      headers: expect.objectContaining({ 'x-csrf-token': 'csrf-1' })
    });
  });

  it('offers Discord login when the API returns 401', async () => {
    fakeApi();
    const wrapper = await mountManage();
    expect(wrapper.text()).toContain('Đăng nhập Discord');
    expect(wrapper.get('a[href*="/api/auth/discord/start"]').attributes('href')).toContain('/api/auth/discord/start');
  });

  it('loads manageable guilds from the API and saves edited settings with CSRF', async () => {
    const calls = fakeApi({ loggedIn: true });
    const storageSpy = vi.spyOn(Storage.prototype, 'setItem');
    const wrapper = await mountManage();
    expect(wrapper.get('select[aria-label="Server quản trị"]').text()).toContain('Guild One');
    await wrapper.get('textarea[aria-label="Lời chào voice"]').setValue('Mừng {user}');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="status"]').text()).toContain('Đã lưu');
    expect(calls.at(-1)?.init?.headers).toMatchObject({ 'x-csrf-token': 'csrf-1' });
    expect(storageSpy).not.toHaveBeenCalled();
    storageSpy.mockRestore();
  });

  it('shows revoked permission and keeps unsaved text after a 403 save', async () => {
    fakeApi({ loggedIn: true, saveStatus: 403 });
    const wrapper = await mountManage();
    await wrapper.get('textarea[aria-label="Lời chào voice"]').setValue('Tin mới {user}');
    await wrapper.get('form').trigger('submit');
    await flushPromises();
    expect(wrapper.get('[role="alert"]').text()).toContain('quyền');
    expect((wrapper.get('textarea[aria-label="Lời chào voice"]').element as HTMLTextAreaElement).value).toBe('Tin mới {user}');
  });
});
