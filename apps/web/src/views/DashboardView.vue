<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { Sparkles, Activity, Users, Hash } from 'lucide-vue-next';
import { useDensityStore } from '../stores/density';
import DensityToggle from '../components/DensityToggle.vue';
import LeaderboardPodium from '../components/LeaderboardPodium.vue';
import ActivityHeatmap from '../components/ActivityHeatmap.vue';
import WordCloudSphere from '../components/WordCloudSphere.vue';
import { getJson } from '../api';
import { toCloudWords, toPodium, type DashboardData } from '../utils/dashboardData';
import { usePageSeo } from '../seo';

usePageSeo('Dashboard trực tiếp | Sentinel Bot', 'Số liệu hoạt động Discord theo thời gian thực từ Sentinel Bot.', '/dashboard', false);

const density = useDensityStore();
const guilds = ref<{ id: string; name: string }[]>([]);
const selectedGuildId = ref('');
const dashboard = ref<DashboardData | null>(null);
const loading = ref(true);
const error = ref('');
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let requestId = 0;

const podium = computed(() => toPodium(dashboard.value?.podium ?? []));
const cloudWords = computed(() => toCloudWords(dashboard.value?.words ?? []));
const stats = computed(() => [
  { icon: Users, label: 'Members', value: dashboard.value?.stats.members.toLocaleString() ?? '—', color: 'text-cyan-400' },
  { icon: Activity, label: 'In voice', value: dashboard.value?.stats.voiceNow.toLocaleString() ?? '—', color: 'text-emerald-400' },
  { icon: Hash, label: 'Messages tracked', value: dashboard.value?.stats.messages.toLocaleString() ?? '—', color: 'text-violet-400' }
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
    const saved = localStorage.getItem('sentinel.guildId');
    selectedGuildId.value = guilds.value.find((guild) => guild.id === saved)?.id ?? guilds.value[0]?.id ?? '';
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
      <p class="text-xs text-gray-500">Updated {{ new Date(dashboard.updatedAt).toLocaleString() }} · Activity times are UTC</p>
      <div :class="['grid gap-6', density.mode === 'immersive' ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1 xl:grid-cols-3 gap-4']">
        <div class="xl:col-span-2">
          <LeaderboardPodium v-if="podium.length" :podium="podium" title="Top chat contributors" unit="messages" />
          <div v-else class="glass-panel p-6 rounded-3xl text-gray-400">No chat activity recorded yet.</div>
        </div>
        <div class="xl:col-span-1">
          <WordCloudSphere v-if="cloudWords.length" :words="cloudWords" :radius="120" />
          <div v-else class="glass-panel p-6 rounded-3xl text-gray-400">No words recorded yet.</div>
        </div>
      </div>
      <ActivityHeatmap :matrix="dashboard.activity.matrix" :days="dashboard.activity.days" />
    </template>
  </div>
</template>
