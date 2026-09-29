<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { Sparkles, Activity, Users, Hash, Mic2 } from 'lucide-vue-next';
import { useDensityStore } from '../stores/density';
import DensityToggle from '../components/DensityToggle.vue';
import LeaderboardPodium from '../components/LeaderboardPodium.vue';
import ActivityHeatmap from '../components/ActivityHeatmap.vue';
import WordCloudSphere from '../components/WordCloudSphere.vue';
import { getJson } from '../api';
import { formatVoiceDuration, toActivitySeries, toCloudWords, toPodium, type DashboardData } from '../utils/dashboardData';
import { usePageSeo } from '../seo';

usePageSeo('Dashboard trực tiếp | Sentinel Bot', 'Số liệu hoạt động Discord theo thời gian thực từ Sentinel Bot.', '/dashboard', false);

const density = useDensityStore();
const route = useRoute();
const guilds = ref<{ id: string; name: string }[]>([]);
const selectedGuildId = ref('');
const dashboard = ref<DashboardData | null>(null);
const loading = ref(true);
const error = ref('');
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let requestId = 0;

const podium = computed(() => toPodium(dashboard.value?.podium ?? []));
const cloudWords = computed(() => toCloudWords(dashboard.value?.words ?? []));
const activitySeries = computed(() => dashboard.value ? toActivitySeries(dashboard.value.activity) : null);
const stats = computed(() => [
  { icon: Users, label: 'Members', value: dashboard.value?.stats.members.toLocaleString() ?? '—', color: 'text-cyan-400' },
  { icon: Activity, label: 'In voice', value: dashboard.value?.stats.voiceNow.toLocaleString() ?? '—', color: 'text-emerald-400' },
  { icon: Hash, label: 'Tin nhắn đã ghi nhận', value: dashboard.value?.stats.messages.toLocaleString() ?? '—', color: 'text-violet-400' },
  { icon: Mic2, label: 'Voice từ khi ghi nhận', value: dashboard.value ? formatVoiceDuration(dashboard.value.stats.voiceTotalEstimatedSeconds) : '—', color: 'text-amber-300' }
]);

async function refreshDashboard() {
  if (!selectedGuildId.value) return;
  const currentRequest = ++requestId;
  try {
    const data = await getJson<DashboardData>(`/api/guilds/${encodeURIComponent(selectedGuildId.value)}/dashboard`);
    if (currentRequest !== requestId) return;
    dashboard.value = data;
    error.value = '';
  } catch (cause) {
    if (currentRequest === requestId) {
      dashboard.value = null;
      error.value = cause instanceof Error ? cause.message : 'Could not load dashboard data';
    }
  } finally {
    if (currentRequest === requestId) loading.value = false;
  }
}

watch(selectedGuildId, (id) => {
  dashboard.value = null;
  loading.value = true;
  if (id) {
    localStorage.setItem('sentinel.guildId', id);
    void refreshDashboard();
  }
});

onMounted(async () => {
  try {
    const result = await getJson<{ guilds: { id: string; name: string }[] }>('/api/guilds');
    guilds.value = result.guilds;
    const requested = typeof route.query.guild === 'string' ? route.query.guild : '';
    const saved = localStorage.getItem('sentinel.guildId');
    selectedGuildId.value = guilds.value.find((guild) => guild.id === requested)?.id ??
      guilds.value.find((guild) => guild.id === saved)?.id ?? guilds.value[0]?.id ?? '';
    if (!selectedGuildId.value) loading.value = false;
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : 'Could not load guilds';
    loading.value = false;
  }
  refreshTimer = setInterval(() => { void refreshDashboard(); }, 30_000);
});

onUnmounted(() => {
  if (refreshTimer) clearInterval(refreshTimer);
  requestId++;
});
</script>

<template>
  <div class="space-y-6">
    <div class="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div class="absolute inset-0 opacity-10 shimmer-sweep pointer-events-none" />
      <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs font-medium mb-3">
            <Sparkles class="w-3.5 h-3.5 text-cyan-400" />
            <span>Sentinel Intelligence Dashboard</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">Community Analytics</h2>
          <p class="mt-2 text-sm text-gray-300 max-w-xl">Live Discord and MongoDB statistics. Updates every 30 seconds.</p>
          <label class="block mt-4 text-xs text-gray-400" for="guild-select">Discord server</label>
          <select id="guild-select" v-model="selectedGuildId" class="mt-1 rounded-lg bg-slate-900 border border-white/20 px-3 py-2 text-white" :disabled="guilds.length === 0">
            <option v-for="guild in guilds" :key="guild.id" :value="guild.id">{{ guild.name }}</option>
          </select>
        </div>
        <div class="flex items-center gap-3 flex-wrap">
          <div v-for="stat in stats" :key="stat.label" class="glass-panel px-4 py-3 rounded-2xl border border-white/10 text-center">
            <component :is="stat.icon" :class="['w-4 h-4 mx-auto mb-1', stat.color]" />
            <span class="block text-xs text-gray-400 uppercase tracking-wider">{{ stat.label }}</span>
            <span :class="['text-base font-bold', stat.color]">{{ stat.value }}</span>
          </div>
          <DensityToggle />
        </div>
      </div>
    </div>

    <p v-if="error" role="alert" class="rounded-xl border border-red-400/30 bg-red-400/10 p-4 text-red-200">Live data unavailable: {{ error }}</p>
    <p v-else-if="loading" class="text-gray-400">Loading live data…</p>
    <p v-else-if="guilds.length === 0" class="text-gray-400">The bot is not connected to a Discord server yet.</p>
    <template v-else-if="dashboard">
      <p class="text-xs text-gray-500">Cập nhật {{ new Date(dashboard.updatedAt).toLocaleString('vi-VN') }} · Biểu đồ theo giờ UTC · Thời gian voice đang tham gia là ước tính ({{ formatVoiceDuration(dashboard.stats.voiceActiveEstimatedSeconds) }})</p>
      <div :class="['grid gap-6', density.mode === 'immersive' ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1 xl:grid-cols-3 gap-4']">
        <div class="xl:col-span-2">
          <router-link :to="{ path: '/dashboard/rankings', query: { guild: selectedGuildId } }" class="mb-3 inline-flex text-sm font-semibold text-cyan-300 hover:text-white">Xem tất cả bảng xếp hạng →</router-link>
          <LeaderboardPodium v-if="podium.length" :podium="podium" title="Top chat contributors" unit="messages" />
          <div v-else class="glass-panel p-6 rounded-3xl text-gray-400">No chat activity recorded yet.</div>
        </div>
        <div class="xl:col-span-1">
          <WordCloudSphere v-if="cloudWords.length" :words="cloudWords" :radius="120" />
          <div v-else class="glass-panel p-6 rounded-3xl text-gray-400">No words recorded yet.</div>
        </div>
      </div>
      <section class="glass-panel p-6 rounded-3xl" aria-labelledby="voice-top-title">
        <h3 id="voice-top-title" class="text-lg font-bold text-white">Top voice từ khi ghi nhận</h3>
        <p class="text-xs text-gray-400 mt-1">Gồm thời gian đã lưu và thời gian phiên đang tham gia (ước tính).</p>
        <ol v-if="dashboard.topVoice.length" class="mt-5 space-y-3">
          <li v-for="user in dashboard.topVoice" :key="user.userId" class="flex items-center gap-3 border-b border-white/10 pb-3 last:border-0 last:pb-0">
            <span class="w-7 text-sm font-mono text-cyan-300">#{{ user.rank }}</span>
            <img v-if="user.avatar" :src="user.avatar" :alt="user.username" class="w-8 h-8 rounded-full object-cover" loading="lazy" />
            <span class="min-w-0 flex-1 truncate text-sm text-white">{{ user.username }}</span>
            <strong class="text-sm text-amber-300">{{ formatVoiceDuration(user.score) }}</strong>
          </li>
        </ol>
        <p v-else class="mt-4 text-sm text-gray-400">Chưa có thời gian voice được ghi nhận.</p>
      </section>
      <div v-if="activitySeries" class="grid gap-6 xl:grid-cols-2">
        <ActivityHeatmap :matrix="activitySeries.messages" :days="dashboard.activity.days" title="Tin nhắn trong 7 ngày" description="Số tin nhắn theo giờ UTC" unit="tin nhắn" />
        <ActivityHeatmap :matrix="activitySeries.voiceJoins" :days="dashboard.activity.days" title="Lượt vào voice trong 7 ngày" description="Số lượt vào kênh theo giờ UTC; không phải thời lượng" unit="lượt vào voice" />
      </div>
    </template>
  </div>
</template>
