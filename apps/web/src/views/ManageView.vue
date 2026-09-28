<script setup lang="ts">
import { onMounted, ref, watch } from 'vue';
import type { GuildSettingsInput, GuildSettingsResponse } from '@sentinel/shared';
import { API_BASE_URL, ApiError, getGuildSettings, getManagedGuilds, patchGuildSettings } from '../api';
import { useAuthStore } from '../stores/auth';
import { usePageSeo } from '../seo';

usePageSeo('Quản trị server | Sentinel Bot', 'Cấu hình Sentinel Bot cho server Discord của bạn.', '/dashboard/manage', false);

const auth = useAuthStore();
const guilds = ref<{ id: string; name: string }[]>([]);
const selectedGuildId = ref('');
const settings = ref<GuildSettingsResponse | null>(null);
const welcomeVoiceTts = ref(true);
const welcomeMessage = ref('');
const reportChannelId = ref('');
const loading = ref(true);
const saving = ref(false);
const error = ref('');
const notice = ref('');
let requestId = 0;

function applySettings(result: GuildSettingsResponse) {
  settings.value = result;
  welcomeVoiceTts.value = result.welcomeVoiceTts;
  welcomeMessage.value = result.welcomeMessage;
  reportChannelId.value = result.reportChannelId ?? '';
}

async function loadSettings() {
  if (!selectedGuildId.value) return;
  const current = ++requestId;
  loading.value = true;
  error.value = '';
  notice.value = '';
  try {
    const result = await getGuildSettings(selectedGuildId.value);
    if (current === requestId) applySettings(result);
  } catch (cause) {
    if (current !== requestId) return;
    if (cause instanceof ApiError && cause.status === 401) auth.clearAuth();
    else error.value = cause instanceof ApiError && cause.status === 403
      ? 'Bạn không còn quyền Manage Server trên server này.'
      : cause instanceof Error ? cause.message : 'Không thể tải cấu hình.';
  } finally {
    if (current === requestId) loading.value = false;
  }
}

watch(selectedGuildId, () => {
  settings.value = null;
  void loadSettings();
});

onMounted(async () => {
  try {
    await auth.loadSession();
    if (!auth.isAuthenticated) return;
    const response = await getManagedGuilds();
    guilds.value = response.guilds;
    selectedGuildId.value = response.guilds[0]?.id ?? '';
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) auth.clearAuth();
    else error.value = cause instanceof Error ? cause.message : 'Không thể tải danh sách server.';
  } finally {
    if (!selectedGuildId.value) loading.value = false;
  }
});

async function save() {
  if (!selectedGuildId.value || !auth.csrfToken || saving.value) return;
  saving.value = true;
  error.value = '';
  notice.value = '';
  const input: GuildSettingsInput = {
    welcomeVoiceTts: welcomeVoiceTts.value,
    welcomeMessage: welcomeMessage.value,
    reportChannelId: reportChannelId.value || null
  };
  try {
    const result = await patchGuildSettings(selectedGuildId.value, input, auth.csrfToken);
    applySettings(result);
    notice.value = 'Đã lưu cấu hình.';
  } catch (cause) {
    if (cause instanceof ApiError && cause.status === 401) auth.clearAuth();
    else error.value = cause instanceof ApiError && cause.status === 403
      ? 'Bạn không còn quyền Manage Server để lưu cấu hình.'
      : cause instanceof Error ? cause.message : 'Không thể lưu cấu hình.';
  } finally {
    saving.value = false;
  }
}

async function logout() {
  try { await auth.logout(); }
  catch (cause) { error.value = cause instanceof Error ? cause.message : 'Không thể đăng xuất.'; }
}
</script>

<template>
  <div class="site-container py-10 sm:py-14">
    <header class="mb-8">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Sentinel / Server settings</p>
      <h1 class="mt-3 text-3xl font-bold text-white sm:text-5xl">Quản trị server</h1>
      <p class="mt-3 max-w-2xl text-sm text-gray-300">Đăng nhập Discord để chỉnh lời chào voice và nơi nhận báo cáo. Chỉ chủ server hoặc người có quyền Manage Server được thay đổi.</p>
    </header>

    <section class="glass-panel max-w-3xl rounded-3xl p-6 sm:p-8" aria-label="Cấu hình server">
      <p v-if="loading" class="text-gray-300">Đang tải cấu hình…</p>
      <template v-else-if="!auth.isAuthenticated">
        <p class="mb-5 text-gray-300">Bạn cần đăng nhập để quản trị Sentinel cho server của mình.</p>
        <a :href="`${API_BASE_URL}/api/auth/discord/start`" class="inline-flex rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950">Đăng nhập Discord</a>
      </template>
      <template v-else>
        <div class="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-6">
          <p class="text-sm text-gray-300">Đã đăng nhập: <strong class="text-white">{{ auth.user?.username }}</strong></p>
          <button type="button" class="text-sm text-cyan-300 hover:text-white" @click="logout">Đăng xuất</button>
        </div>
        <p v-if="error" role="alert" class="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-red-200">{{ error }}</p>
        <p v-if="notice" role="status" class="mb-5 rounded-lg border border-emerald-400/30 bg-emerald-400/10 p-4 text-emerald-200">{{ notice }}</p>
        <p v-if="guilds.length === 0" class="text-gray-300">Không có server nào vừa cài bot vừa thuộc quyền quản lý của bạn.</p>
        <template v-else>
          <label for="admin-guild" class="block text-sm font-medium text-white">Server</label>
          <select id="admin-guild" v-model="selectedGuildId" aria-label="Server quản trị" class="mt-2 w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-white">
            <option v-for="guild in guilds" :key="guild.id" :value="guild.id">{{ guild.name }}</option>
          </select>
          <form v-if="settings" class="mt-7 space-y-6" @submit.prevent="save">
            <div class="flex items-start gap-3">
              <input id="voice-tts" v-model="welcomeVoiceTts" type="checkbox" class="mt-1" />
              <label for="voice-tts" class="text-sm text-white">Bật lời chào bằng giọng nói khi thành viên vào kênh voice</label>
            </div>
            <div>
              <label for="voice-message" class="block text-sm font-medium text-white">Lời chào voice</label>
              <p class="mb-2 mt-1 text-xs text-gray-400">Dùng {user} để chèn tên thành viên. Tối đa 200 ký tự.</p>
              <textarea id="voice-message" v-model="welcomeMessage" aria-label="Lời chào voice" maxlength="200" rows="3" class="w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-white" />
            </div>
            <div>
              <label for="report-channel" class="block text-sm font-medium text-white">Kênh nhận báo cáo</label>
              <p class="mb-2 mt-1 text-xs text-gray-400">Bỏ chọn để tắt. Báo cáo gửi thứ Hai lúc 09:00 giờ Việt Nam và ghi rõ số liệu cộng dồn.</p>
              <select id="report-channel" v-model="reportChannelId" class="w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-white">
                <option value="">Tắt báo cáo</option>
                <option v-for="channel in settings.channels" :key="channel.id" :value="channel.id">#{{ channel.name }}</option>
              </select>
            </div>
            <button type="submit" aria-label="Lưu cấu hình" :disabled="saving" class="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50">{{ saving ? 'Đang lưu…' : 'Lưu cấu hình' }}</button>
          </form>
        </template>
      </template>
    </section>
  </div>
</template>
