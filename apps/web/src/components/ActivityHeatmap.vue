<script setup lang="ts">
import { computed } from 'vue';
import { calculateHeatmapColor } from '../utils/heatmap';

const props = defineProps<{
  matrix: number[][]; // 7 days x 24 hours
  days?: string[];
}>();

const HOUR_LABELS = ['0h', '6h', '12h', '18h', '23h'];
const dayLabels = computed(() => props.days?.map((day) => new Date(`${day}T00:00:00Z`).toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' })) ?? ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);

const maxVal = computed(() => {
  let m = 0;
  for (const row of props.matrix) {
    for (const v of row) {
      if (v > m) m = v;
    }
  }
  return m || 1;
});

function getColor(val: number): string {
  return calculateHeatmapColor(val, maxVal.value);
}
</script>

<template>
  <div class="glass-panel p-6 rounded-3xl relative overflow-hidden">
    <!-- Header -->
    <div class="flex items-center justify-between mb-5">
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-cyan-400/10 border border-cyan-400/30">
          <span class="block w-3 h-3 rounded-full bg-cyan-400 animate-pulse" />
        </div>
        <div>
          <h3 class="text-base font-bold text-white tracking-wide">
            Biểu đồ Hoạt động Máy chủ
          </h3>
          <p class="text-xs text-gray-400">24h × 7 ngày — voice &amp; chat density</p>
        </div>
      </div>
      <span class="text-xs font-mono px-2.5 py-1 rounded-full bg-violet-400/10 border border-violet-400/30 text-violet-300">
        HEATMAP
      </span>
    </div>

    <!-- Hour axis labels -->
    <div class="flex mb-1.5 pl-10">
      <div
        v-for="label in HOUR_LABELS"
        :key="label"
        class="flex-1 text-center text-[10px] text-gray-500 font-mono"
      >
        {{ label }}
      </div>
    </div>

    <!-- Grid with day labels -->
    <div class="space-y-1.5">
      <div
        v-for="(day, dIdx) in matrix"
        :key="dIdx"
        class="flex items-center gap-1.5"
      >
        <!-- Day label -->
        <span class="w-8 text-right text-[10px] text-gray-500 font-mono shrink-0">
          {{ dayLabels[dIdx] }}
        </span>
        <!-- Hour cells -->
        <div class="flex gap-1 flex-1">
          <div
            v-for="(val, hIdx) in day"
            :key="hIdx"
            :style="{ backgroundColor: getColor(val) }"
            class="flex-1 h-4 rounded-sm transform-gpu transition-transform duration-150 hover:scale-125 cursor-default"
            :title="`${days?.[dIdx] ?? dayLabels[dIdx]}, ${hIdx}h UTC: ${val} activities`"
          />
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-2 mt-4 justify-end">
      <span class="text-[10px] text-gray-500">Low</span>
      <div
        v-for="i in 5"
        :key="i"
        class="w-3 h-3 rounded-sm"
        :style="{ backgroundColor: `rgba(0, 242, 254, ${0.1 + i * 0.18})` }"
      />
      <span class="text-[10px] text-gray-500">High</span>
    </div>
  </div>
</template>
