<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { RankingMetric, RankingPage } from '@sentinel/shared';
import { getJson, getRankingPage } from '../api';
import { formatVoiceDuration } from '../utils/dashboardData';
import { usePageSeo } from '../seo';

usePageSeo('Bảng xếp hạng | Sentinel Bot', 'Xem thống kê tin nhắn, voice và cấp độ đã ghi nhận trong Discord.', '/dashboard/rankings', false);

const route = useRoute();
const guilds = ref<{ id: string; name: string }[]>([]);
const selectedGuildId = ref('');
const selectedMetric = ref<RankingMetric>('chat');
const ranking = ref<RankingPage | null>(null);
const cursors = ref<(string | undefined)[]>([undefined]);
const pageIndex = ref(0);
const loading = ref(true);
const error = ref('');
let requestId = 0;

const tabs: { metric: RankingMetric; label: string }[] = [
  { metric: 'chat', label: 'Tin nhắn' },
  { metric: 'voice', label: 'Voice' },
  { metric: 'level', label: 'Cấp độ' }
];
const hasNext = computed(() => !!ranking.value?.nextCursor);

async function loadPage() {
  if (!selectedGuildId.value) return;
  const current = ++requestId;
  loading.value = true;
  error.value = '';
  try {
    const result = await getRankingPage(selectedGuildId.value, selectedMetric.value, cursors.value[pageIndex.value]);
    if (current !== requestId) return;
    ranking.value = result;
  } catch (cause) {
    if (current !== requestId) return;
    ranking.value = null;
    error.value = cause instanceof Error ? cause.message : 'Không thể tải bảng xếp hạng.';
  } finally {
    if (current === requestId) loading.value = false;
  }
}

watch([selectedGuildId, selectedMetric], () => {
  cursors.value = [undefined];
  pageIndex.value = 0;
  ranking.value = null;
  if (selectedGuildId.value) {
    localStorage.setItem('sentinel.guildId', selectedGuildId.value);
    void loadPage();
  }
});

function nextPage() {
  if (!ranking.value?.nextCursor) return;
  cursors.value = [...cursors.value.slice(0, pageIndex.value + 1), ranking.value.nextCursor];
  pageIndex.value++;
  void loadPage();
}

function previousPage() {
  if (pageIndex.value === 0) return;
  pageIndex.value--;
  void loadPage();
}

onMounted(async () => {
  try {
    const response = await getJson<{ guilds: { id: string; name: string }[] }>('/api/guilds');
    guilds.value = response.guilds;
    const requested = typeof route.query.guild === 'string' ? route.query.guild : localStorage.getItem('sentinel.guildId');
    selectedGuildId.value = response.guilds.find((guild) => guild.id === requested)?.id ?? response.guilds[0]?.id ?? '';
    if (!selectedGuildId.value) loading.value = false;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Không thể tải danh sách server.';
    loading.value = false;
  }
});
onUnmounted(() => { requestId++; });
</script>

<template>
  <div class="site-container py-10 sm:py-14">
    <header class="mb-8">
      <p class="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-300">Sentinel / Community</p>
      <h1 class="mt-3 text-3xl font-bold text-white sm:text-5xl">Bảng xếp hạng</h1>
      <p class="mt-3 max-w-2xl text-sm text-gray-300">Tất cả thành viên từng có số liệu từ khi Sentinel bắt đầu ghi nhận. Bảng Voice xếp theo thời gian đã lưu; phiên đang tham gia sẽ được cộng sau khi kết thúc.</p>
    </header>

    <section class="glass-panel rounded-3xl p-5 sm:p-8" aria-label="Bảng xếp hạng">
      <div class="mb-7 flex flex-wrap items-end justify-between gap-5">
        <div>
          <label for="ranking-guild" class="block text-xs font-medium text-gray-300">Discord server</label>
          <select id="ranking-guild" v-model="selectedGuildId" class="mt-2 rounded-lg border border-white/20 bg-slate-900 px-3 py-2 text-white" :disabled="guilds.length === 0">
            <option v-for="guild in guilds" :key="guild.id" :value="guild.id">{{ guild.name }}</option>
          </select>
        </div>
        <div class="flex flex-wrap gap-2" role="tablist" aria-label="Loại xếp hạng">
          <button v-for="tab in tabs" :key="tab.metric" type="button" role="tab" :aria-label="tab.label" :aria-selected="selectedMetric === tab.metric" :class="['rounded-full px-4 py-2 text-sm font-semibold transition-colors', selectedMetric === tab.metric ? 'bg-cyan-300 text-slate-950' : 'border border-white/15 text-gray-300 hover:text-white']" @click="selectedMetric = tab.metric">{{ tab.label }}</button>
        </div>
      </div>

      <p v-if="error" role="alert" class="rounded-lg border border-red-400/30 bg-red-400/10 p-4 text-red-200">{{ error }}</p>
      <p v-else-if="loading" class="py-8 text-gray-300">Đang tải xếp hạng…</p>
      <p v-else-if="guilds.length === 0" class="py-8 text-gray-300">Bot chưa tham gia server nào.</p>
      <p v-else-if="!ranking?.rows.length" class="py-8 text-gray-300">Chưa có dữ liệu cho bảng này.</p>
      <ol v-else class="divide-y divide-white/10">
        <li v-for="row in ranking.rows" :key="row.userId" class="flex items-center gap-3 py-3 sm:gap-5">
          <span class="w-10 shrink-0 font-mono text-sm text-cyan-300">#{{ row.rank }}</span>
          <img v-if="row.avatar" :src="row.avatar" :alt="row.username" class="h-9 w-9 rounded-full object-cover" loading="lazy" />
          <span v-else class="h-9 w-9 rounded-full bg-white/10" aria-hidden="true" />
          <span class="min-w-0 flex-1 truncate text-sm font-medium text-white">{{ row.username }}</span>
          <strong v-if="selectedMetric === 'voice'" class="text-right text-sm text-amber-200">{{ formatVoiceDuration(row.score) }} <span class="text-xs font-normal text-gray-400">đã lưu</span></strong>
          <strong v-else-if="selectedMetric === 'level'" class="text-right text-sm text-cyan-200">Cấp {{ row.level }} <span class="block text-xs font-normal text-gray-400">{{ row.score.toLocaleString() }} XP</span></strong>
          <strong v-else class="text-right text-sm text-cyan-200">{{ row.score.toLocaleString() }} <span class="text-xs font-normal text-gray-400">tin nhắn</span></strong>
        </li>
      </ol>

      <div v-if="ranking && ranking.rows.length" class="mt-6 flex items-center justify-between border-t border-white/10 pt-5">
        <button type="button" aria-label="Trang trước" class="rounded-lg border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40" :disabled="pageIndex === 0 || loading" @click="previousPage">← Trước</button>
        <span class="text-xs text-gray-400">Trang {{ pageIndex + 1 }} · Cập nhật {{ new Date(ranking.generatedAt).toLocaleString('vi-VN') }}</span>
        <button type="button" aria-label="Trang tiếp" class="rounded-lg border border-white/20 px-4 py-2 text-sm text-white disabled:opacity-40" :disabled="!hasNext || loading" @click="nextPage">Tiếp →</button>
      </div>
    </section>
  </div>
</template>
