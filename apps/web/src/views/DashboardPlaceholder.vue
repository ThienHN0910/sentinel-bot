<script setup lang="ts">
import { Sparkles, Activity, Cpu } from 'lucide-vue-next';
import { useDensityStore } from '../stores/density';

const density = useDensityStore();
</script>

<template>
  <div class="space-y-6">
    <!-- Hero Cyber Banner -->
    <div class="glass-panel relative overflow-hidden rounded-3xl p-6 sm:p-8 border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)]">
      <!-- Shimmer Background Sweep -->
      <div class="absolute inset-0 opacity-10 shimmer-sweep pointer-events-none"></div>

      <div class="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <div class="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300 text-xs font-medium mb-3">
            <Sparkles class="w-3.5 h-3.5 text-cyan-400" />
            <span>Deep Obsidian Glassmorphism Engine</span>
          </div>
          <h2 class="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
            Cyber Dashboard Ready
          </h2>
          <p class="mt-2 text-sm text-gray-300 max-w-xl">
            High-performance Vue 3 dashboard scaffolded with Pinia density control, Tailwind CSS, and GPU-accelerated telemetry visuals.
          </p>
        </div>

        <div class="flex items-center gap-3">
          <div class="glass-panel px-4 py-3 rounded-2xl border border-white/10 text-center">
            <span class="block text-xs text-gray-400 uppercase tracking-wider">Density</span>
            <span class="text-base font-bold text-cyan-400 capitalize">{{ density.mode }}</span>
          </div>
          <div class="glass-panel px-4 py-3 rounded-2xl border border-white/10 text-center">
            <span class="block text-xs text-gray-400 uppercase tracking-wider">FPS Target</span>
            <span class="text-base font-bold text-emerald-400">60 FPS</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Dashboard Preview Grid -->
    <div
      :class="[
        'grid gap-6',
        density.mode === 'immersive'
          ? 'grid-cols-1 md:grid-cols-3'
          : 'grid-cols-1 md:grid-cols-3 gap-3'
      ]"
    >
      <div class="glass-panel p-5 rounded-2xl border border-white/10">
        <div class="flex items-center gap-2 text-cyan-400 mb-2">
          <Activity class="w-4 h-4" />
          <h3 class="font-bold text-sm text-white">Active Voice & Chat</h3>
        </div>
        <p class="text-xs text-gray-400">Synchronized real-time analytics with MongoDB Atlas.</p>
      </div>

      <div class="glass-panel p-5 rounded-2xl border border-white/10">
        <div class="flex items-center gap-2 text-violet-400 mb-2">
          <Sparkles class="w-4 h-4" />
          <h3 class="font-bold text-sm text-white">3D Retina Wheel</h3>
        </div>
        <p class="text-xs text-gray-400">WebSockets synchronized physics spinning wheel.</p>
      </div>

      <div class="glass-panel p-5 rounded-2xl border border-white/10">
        <div class="flex items-center gap-2 text-emerald-400 mb-2">
          <Cpu class="w-4 h-4" />
          <h3 class="font-bold text-sm text-white">Adaptive Governor</h3>
        </div>
        <p class="text-xs text-gray-400">Duty-cycle regulation ensuring zero Oracle idle reclaim.</p>
      </div>
    </div>
  </div>
</template>
