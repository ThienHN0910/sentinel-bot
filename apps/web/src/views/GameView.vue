<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { GameAction, GameKind, GameSessionView, RpsChoice } from '@sentinel/shared';
import { API_BASE_URL, ApiError, actOnGameSession, createGameSession, getGameSession, getJson } from '../api';
import { useAuthStore } from '../stores/auth';
import { usePageSeo } from '../seo';

usePageSeo('Game cộng đồng | Sentinel Bot', 'Chơi cờ 3×3 và oẳn tù tì với thành viên cùng server Discord.', '/games/new', false);

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();
const session = ref<GameSessionView | null>(null);
const guilds = ref<{ id: string; name: string }[]>([]);
const selectedGuild = ref('');
const loading = ref(true);
const busy = ref(false);
const error = ref('');
const notice = ref('');
const isNew = computed(() => route.path === '/games/new');
const sessionId = computed(() => typeof route.params.sessionId === 'string' ? route.params.sessionId : '');
const isPlayer = computed(() => !!session.value && !!auth.user &&
  [session.value.creatorId, session.value.opponentId].includes(auth.user.id));
const canMove = computed(() => isPlayer.value && session.value?.phase === 'active' && session.value.turnId === auth.user?.id);
const loginHref = computed(() => `${API_BASE_URL}/api/auth/discord/start?return_to=${encodeURIComponent(route.path)}`);
let timer: ReturnType<typeof setInterval> | undefined;
let requestId = 0;

function describeError(cause: unknown) {
  if (cause instanceof ApiError) {
    if (cause.status === 401) { auth.clearAuth(); return 'Phiên đăng nhập đã hết hạn. Hãy đăng nhập lại.'; }
    if (cause.status === 403) return 'Bạn không còn là thành viên của server này hoặc không có quyền chơi ván.';
    if (cause.status === 409) return 'Ván vừa thay đổi ở nơi khác. Đã tải lại trạng thái mới.';
    if (cause.status === 410) return 'Ván đã hết thời gian chơi.';
    if (cause.status === 404) return 'Không tìm thấy ván này.';
  }
  return cause instanceof Error ? cause.message : 'Không thể tải ván.';
}

async function refresh() {
  if (!sessionId.value) return;
  const current = ++requestId;
  try {
    const result = await getGameSession(sessionId.value);
    if (current === requestId) { session.value = result; error.value = ''; schedule(); }
  } catch (cause) {
    if (current === requestId) { error.value = describeError(cause); stopPolling(); }
  }
}

function stopPolling() { if (timer) clearInterval(timer); timer = undefined; }
function schedule() {
  stopPolling();
  if (session.value && ['waiting', 'active'].includes(session.value.phase) && document.visibilityState === 'visible') {
    timer = setInterval(() => void refresh(), 5000);
  }
}
function visibilityChanged() { schedule(); if (document.visibilityState === 'visible' && !isNew.value) void refresh(); }

async function initialize() {
  const current = ++requestId;
  loading.value = true; error.value = ''; session.value = null; stopPolling();
  try {
    await auth.loadSession();
    if (isNew.value) {
      if (auth.isAuthenticated) {
        const result = await getJson<{ guilds: { id: string; name: string }[] }>('/api/games/guilds');
        if (current === requestId) { guilds.value = result.guilds; selectedGuild.value = result.guilds[0]?.id ?? ''; }
      }
    } else if (sessionId.value) {
      const result = await getGameSession(sessionId.value);
      if (current === requestId) { session.value = result; schedule(); }
    }
  } catch (cause) { if (current === requestId) error.value = describeError(cause); }
  finally { if (current === requestId) loading.value = false; }
}

async function create(kind: GameKind) {
  if (!selectedGuild.value || !auth.csrfToken || busy.value) return;
  busy.value = true; error.value = '';
  try {
    const created = await createGameSession(selectedGuild.value, kind, auth.csrfToken);
    await router.push(`/games/${created.sessionId}`);
  } catch (cause) { error.value = describeError(cause); }
  finally { busy.value = false; }
}

async function act(action: GameAction) {
  if (!session.value || !auth.csrfToken || busy.value) return;
  busy.value = true; error.value = ''; notice.value = '';
  try {
    const updated = await actOnGameSession(session.value.sessionId, action, auth.csrfToken);
    session.value = updated;
    notice.value = action.type === 'choose' ? 'Đã ghi nhận lựa chọn kín của bạn.' : 'Đã cập nhật ván.';
    schedule();
  } catch (cause) {
    error.value = describeError(cause);
    if (cause instanceof ApiError && [409, 410].includes(cause.status)) await refresh();
  } finally { busy.value = false; }
}

watch(() => route.fullPath, () => void initialize());
onMounted(() => { document.addEventListener('visibilitychange', visibilityChanged); void initialize(); });
onUnmounted(() => { requestId++; stopPolling(); document.removeEventListener('visibilitychange', visibilityChanged); });
</script>

<template>
  <main class="site-container py-10 sm:py-16">
    <header class="mb-8 max-w-3xl">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Sentinel / Games</p>
      <h1 class="mt-3 text-4xl font-bold text-white sm:text-6xl">{{ isNew ? 'Chơi cùng server.' : session?.kind === 'rps' ? 'Oẳn tù tì.' : 'Cờ 3×3.' }}</h1>
      <p class="mt-4 text-gray-300">Một ván chung giữa Discord và web. Không cược xu, không thưởng XP.</p>
    </header>
    <section class="glass-panel max-w-3xl rounded-3xl p-5 sm:p-8" aria-live="polite">
      <p v-if="loading" role="status" class="text-gray-300">Đang tải...</p>
      <template v-else>
        <p v-if="error" role="alert" class="mb-5 rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-red-200">{{ error }}</p>
        <p v-if="notice" role="status" class="mb-5 text-emerald-300">{{ notice }}</p>
        <div v-if="!auth.isAuthenticated" class="mb-6">
          <p class="mb-3 text-gray-300">Đăng nhập Discord để tạo ván hoặc tham gia. Bạn vẫn xem được trạng thái ván qua liên kết.</p>
          <a :href="loginHref" class="inline-block rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950">Đăng nhập Discord</a>
        </div>
        <template v-if="isNew">
          <div v-if="auth.isAuthenticated && guilds.length" class="space-y-5">
            <label for="game-guild" class="block text-sm text-gray-300">Chọn server có Sentinel</label>
            <select id="game-guild" v-model="selectedGuild" aria-label="Chọn server" class="w-full rounded-lg border border-white/20 bg-slate-900 px-3 py-3 text-white">
              <option v-for="guild in guilds" :key="guild.id" :value="guild.id">{{ guild.name }}</option>
            </select>
            <div class="flex flex-wrap gap-3">
              <button type="button" aria-label="Tạo ván cờ 3×3" :disabled="busy" class="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50" @click="create('tictactoe')">Tạo ván cờ 3×3</button>
              <button type="button" aria-label="Tạo ván oẳn tù tì" :disabled="busy" class="rounded-lg border border-white/30 px-5 py-3 font-semibold text-white disabled:opacity-50" @click="create('rps')">Tạo ván oẳn tù tì</button>
            </div>
          </div>
          <p v-else-if="auth.isAuthenticated" class="text-gray-300">Bot chưa có trong server nào bạn có thể chọn.</p>
        </template>
        <template v-else-if="session">
          <p class="text-lg font-semibold text-white">{{ session.phase === 'waiting' ? 'Đang chờ người thứ hai' : session.phase === 'expired' ? 'Ván đã hết hạn' : session.phase === 'finished' ? session.result?.winnerId ? `Người thắng: ${session.result.winnerId}` : 'Hòa' : 'Đang chơi' }}</p>
          <p class="mt-2 break-all text-sm text-gray-300">Mã ván: {{ session.sessionId }} · Hết hạn: {{ new Date(session.expiresAt).toLocaleString('vi-VN') }}</p>
          <p class="mt-1 text-sm text-gray-300">Người tạo: {{ session.creatorId }} · Người tham gia: {{ session.opponentId || 'chưa có' }}</p>
          <div v-if="session.phase === 'waiting' && auth.isAuthenticated && auth.user?.id !== session.creatorId" class="mt-6">
            <button type="button" :disabled="busy" class="rounded-lg bg-cyan-300 px-5 py-3 font-semibold text-slate-950 disabled:opacity-50" @click="act({ type: 'join' })">Tham gia ván</button>
          </div>
          <template v-if="session.kind === 'tictactoe'">
            <p v-if="session.phase === 'active'" class="mt-6 text-white">Lượt của: {{ session.turnId === session.creatorId ? 'X' : 'O' }}</p>
            <div class="mt-5 grid w-full max-w-sm grid-cols-3 gap-2" role="group" aria-label="Bàn cờ 3×3">
              <button v-for="(cell, index) in session.board" :key="index" type="button" :aria-label="`Đánh ô ${index + 1}`" :disabled="!canMove || !!cell || busy" class="aspect-square min-h-20 rounded-lg border border-white/20 bg-slate-900 text-3xl font-bold text-cyan-200 disabled:cursor-default disabled:opacity-70" @click="act({ type: 'place', cell: index })">{{ cell || '·' }}</button>
            </div>
          </template>
          <template v-else>
            <p class="mt-6 text-gray-300">Người tạo {{ session.rps?.creatorChosen ? 'đã chọn' : 'chưa chọn' }} · Người tham gia {{ session.rps?.opponentChosen ? 'đã chọn' : 'chưa chọn' }}</p>
            <p v-if="session.rps?.ownChoice" class="mt-2 text-cyan-300">Bạn đã chọn: {{ session.rps.ownChoice }}</p>
            <p v-if="session.rps?.choices" class="mt-2 text-white">Kết quả: {{ session.rps.choices.creator }} / {{ session.rps.choices.opponent }}</p>
            <div v-if="session.phase === 'active' && isPlayer && !session.rps?.ownChoice" class="mt-5 flex flex-wrap gap-2">
              <button v-for="choice in (['rock', 'paper', 'scissors'] as RpsChoice[])" :key="choice" type="button" :aria-label="`Chọn ${choice === 'rock' ? 'búa' : choice === 'paper' ? 'bao' : 'kéo'}`" :disabled="busy" class="rounded-lg border border-white/30 px-5 py-3 text-white disabled:opacity-50" @click="act({ type: 'choose', choice })">{{ choice === 'rock' ? 'Búa' : choice === 'paper' ? 'Bao' : 'Kéo' }}</button>
            </div>
          </template>
          <div class="mt-8 flex flex-wrap gap-4 text-sm">
            <a v-if="session.discordMessageUrl" :href="session.discordMessageUrl" target="_blank" rel="noopener noreferrer" class="text-cyan-300 underline">Mở tin nhắn Discord</a>
            <span v-else class="text-gray-300">Mở trên Discord: <code>/game open id:{{ session.sessionId }}</code></span>
            <RouterLink to="/games/new" class="text-cyan-300 underline">Tạo ván khác</RouterLink>
          </div>
        </template>
      </template>
    </section>
  </main>
</template>
