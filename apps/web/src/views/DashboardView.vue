<script setup lang="ts">
import { ref, computed } from 'vue';
import { Sparkles, Activity, Users, Hash } from 'lucide-vue-next';
import { useDensityStore } from '../stores/density';
import DensityToggle from '../components/DensityToggle.vue';
import LeaderboardPodium from '../components/LeaderboardPodium.vue';
import ActivityHeatmap from '../components/ActivityHeatmap.vue';
import WordCloudSphere from '../components/WordCloudSphere.vue';
import type { PodiumUser } from '../components/LeaderboardPodium.vue';
import type { CloudWord } from '../components/WordCloudSphere.vue';

const density = useDensityStore();

// ─── Mock / placeholder data (replace with API calls) ────────────────────────
const podium = ref<PodiumUser[]>([
  { rank: 1, username: 'CyberAlpha', avatar: '', score: 9850 },
  { rank: 2, username: 'NeonBeta',   avatar: '', score: 7620 },
  { rank: 3, username: 'VoidGamma',  avatar: '', score: 5430 }
]);

// 7 days × 24 hours matrix (random demo data)
const heatmapMatrix = ref<number[][]>(
  Array.from({ length: 7 }, () =>
    Array.from({ length: 24 }, () => Math.floor(Math.random() * 12))
  )
);

const cloudWords = ref<CloudWord[]>([
  { text: 'memes',    weight: 9,  color: '#00f2fe' },
  { text: 'music',    weight: 8,  color: '#7f00ff' },
  { text: 'gaming',   weight: 10, color: '#00f2fe' },
  { text: 'crypto',   weight: 6,  color: '#ff007f' },
  { text: 'anime',    weight: 9,  color: '#7f00ff' },
  { text: 'discord',  weight: 5,  color: '#00f2fe' },
  { text: 'art',      weight: 4,  color: '#00ff88' },
  { text: 'vibe',     weight: 7,  color: '#00f2fe' },
  { text: 'bot',      weight: 6,  color: '#7f00ff' },
  { text: 'events',   weight: 5,  color: '#ff007f' },
  { text: 'rank',     weight: 8,  color: '#00f2fe' },
  { text: 'server',   weight: 7,  color: '#7f00ff' },
  { text: 'voice',    weight: 6,  color: '#00ff88' },
  { text: 'chill',    weight: 5,  color: '#00f2fe' },
  { text: 'study',    weight: 4,  color: '#7f00ff' },
  { text: 'code',     weight: 8,  color: '#00f2fe' },
  { text: 'games',    weight: 9,  color: '#ff007f' },
  { text: 'help',     weight: 3,  color: '#00f2fe' },
  { text: 'chat',     weight: 7,  color: '#7f00ff' },
  { text: 'fun',      weight: 6,  color: '#00ff88' },
]);

// Stats bar
const stats = computed(() => [
  { icon: Users,    label: 'Members',  value: '1,284', color: 'text-cyan-400' },
  { icon: Activity, label: 'Online',   value: '317',   color: 'text-emerald-400' },
  { icon: Hash,     label: 'Messages', value: '52.4K', color: 'text-violet-400' },
]);
</script>

<template>
  <div class="space-y-6">
    <!-- ── Hero Banner ─────────────────────────────────────────────────────── -->
    <div class="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8">
      <div class="absolute inset-0 opacity-10 shimmer-sweep pointer-events-none" />
      <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs font-medium mb-3">
            <Sparkles class="w-3.5 h-3.5 text-cyan-400" />
            <span>Sentinel Intelligence Dashboard</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Community Analytics
          </h2>
          <p class="mt-2 text-sm text-gray-300 max-w-xl">
            Real-time leaderboard podiums, server activity heatmap, and community word-cloud — all GPU-accelerated.
          </p>
        </div>
        <div class="flex items-center gap-3">
          <!-- Quick stats -->
          <div
            v-for="stat in stats"
            :key="stat.label"
            class="glass-panel px-4 py-3 rounded-2xl border border-white/10 text-center"
          >
            <component :is="stat.icon" :class="['w-4 h-4 mx-auto mb-1', stat.color]" />
            <span class="block text-xs text-gray-400 uppercase tracking-wider">{{ stat.label }}</span>
            <span :class="['text-base font-bold', stat.color]">{{ stat.value }}</span>
          </div>
          <DensityToggle />
        </div>
      </div>
    </div>

    <!-- ── Main Grid ───────────────────────────────────────────────────────── -->
    <div
      :class="[
        'grid gap-6',
        density.mode === 'immersive' ? 'grid-cols-1 xl:grid-cols-3' : 'grid-cols-1 xl:grid-cols-3 gap-4'
      ]"
    >
      <!-- Leaderboard Podium (full width on small screens, spans 2 cols on xl) -->
      <div class="xl:col-span-2">
        <LeaderboardPodium :podium="podium" title="Top Contributors" unit="pts" />
      </div>

      <!-- Word Cloud Sphere -->
      <div class="xl:col-span-1">
        <WordCloudSphere :words="cloudWords" :radius="120" />
      </div>
    </div>

    <!-- ── Activity Heatmap ────────────────────────────────────────────────── -->
    <ActivityHeatmap :matrix="heatmapMatrix" />
  </div>
</template>
