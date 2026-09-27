<script setup lang="ts">
import { Trophy, Medal, Award, Crown, Flame } from 'lucide-vue-next';

export interface PodiumUser {
  username: string;
  avatar: string;
  score: number;
  rank: number;
}

const props = withDefaults(
  defineProps<{
    podium: PodiumUser[];
    title?: string;
    unit?: string;
  }>(),
  {
    title: 'Top Contributors',
    unit: 'pts'
  }
);

function getMedalColor(rank: number) {
  if (rank === 1) return 'text-amber-400';
  if (rank === 2) return 'text-slate-200';
  return 'text-amber-600';
}

function getBorderColor(rank: number) {
  if (rank === 1) return 'border-amber-400/60 shadow-[0_0_30px_rgba(251,191,36,0.25)]';
  if (rank === 2) return 'border-slate-300/40 shadow-[0_0_20px_rgba(203,213,225,0.15)]';
  return 'border-amber-700/40 shadow-[0_0_15px_rgba(180,83,9,0.15)]';
}

function getPodiumHeight(rank: number) {
  if (rank === 1) return 'h-72 order-2';
  if (rank === 2) return 'h-60 order-1';
  return 'h-52 order-3';
}
</script>

<template>
  <div class="glass-panel p-6 rounded-3xl relative overflow-hidden">
    <!-- Header with Cyber flair -->
    <div class="flex items-center justify-between mb-6">
      <div class="flex items-center gap-2.5">
        <div class="p-2 rounded-xl bg-amber-400/10 border border-amber-400/30 text-amber-400">
          <Crown class="w-5 h-5" />
        </div>
        <div>
          <h3 class="text-base font-bold text-white tracking-wide flex items-center gap-2">
            {{ title }}
            <Flame class="w-4 h-4 text-orange-400 animate-pulse" />
          </h3>
          <p class="text-xs text-gray-400">Bảng vàng vinh danh Top 3 máy chủ</p>
        </div>
      </div>
      <span class="text-xs font-mono px-2.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300">
        LIVE PODIUM
      </span>
    </div>

    <!-- 3D Perspective Podium Layout (100% GPU-accelerated transforms) -->
    <div class="grid grid-cols-3 gap-3 sm:gap-4 items-end pt-4 pb-2 [perspective:1000px]">
      <div
        v-for="user in podium"
        :key="user.rank"
        :class="[
          'glass-panel p-4 rounded-2xl flex flex-col items-center justify-between text-center relative overflow-hidden transform-gpu transition-transform duration-300 ease-out hover:-translate-y-3 hover:scale-[1.02]',
          getPodiumHeight(user.rank),
          getBorderColor(user.rank)
        ]"
      >
        <!-- Shimmer Progress Sweep on Podium Pillar -->
        <div class="absolute inset-0 opacity-15 shimmer-sweep pointer-events-none rounded-2xl"></div>

        <!-- Rank Crown / Medal Badge -->
        <div class="relative z-10 w-full flex justify-between items-center px-1">
          <span
            :class="[
              'text-[11px] font-extrabold px-2 py-0.5 rounded-full border',
              user.rank === 1
                ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                : user.rank === 2
                ? 'bg-slate-300/20 text-slate-200 border-slate-300/40'
                : 'bg-amber-700/20 text-amber-500 border-amber-700/40'
            ]"
          >
            #{{ user.rank }}
          </span>
          <component
            :is="user.rank === 1 ? Trophy : user.rank === 2 ? Medal : Award"
            :class="['w-4 h-4', getMedalColor(user.rank)]"
          />
        </div>

        <!-- Avatar with Glowing Cyber Ring -->
        <div class="relative z-10 my-auto flex flex-col items-center">
          <div class="relative">
            <div
              :class="[
                'absolute -inset-1 rounded-full blur-sm opacity-60',
                user.rank === 1 ? 'bg-amber-400' : user.rank === 2 ? 'bg-cyan-400' : 'bg-amber-600'
              ]"
            ></div>
            <img
              :src="user.avatar || `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(user.username)}`"
              :alt="user.username"
              class="relative w-14 h-14 sm:w-16 sm:h-16 rounded-full object-cover border-2 border-white/20 bg-space"
              loading="lazy"
            />
            <div
              :class="[
                'absolute -bottom-1 -right-1 p-1 rounded-full bg-[#0a0b10] border border-white/20',
                getMedalColor(user.rank)
              ]"
            >
              <Trophy class="w-3.5 h-3.5" />
            </div>
          </div>

          <!-- Username & Metrics -->
          <span class="mt-3 font-bold text-sm sm:text-base text-white truncate max-w-[90px] sm:max-w-[120px]">
            {{ user.username }}
          </span>
          <span class="text-xs font-mono font-semibold text-cyan-300 mt-0.5">
            {{ user.score.toLocaleString() }} {{ unit }}
          </span>
        </div>

        <!-- Base Pedestal Level Indicator -->
        <div class="relative z-10 w-full pt-2 border-t border-white/10 flex items-center justify-center">
          <span class="text-[10px] tracking-widest font-mono uppercase text-gray-400">
            {{ user.rank === 1 ? 'GOLD CHAMPION' : user.rank === 2 ? 'SILVER RUNNER' : 'BRONZE ELITE' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
