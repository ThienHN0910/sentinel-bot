<script setup lang="ts">
import { useDensityStore } from './stores/density';
import DensityToggle from './components/DensityToggle.vue';
import { Shield, Activity, Radio, Cpu, Sparkles } from 'lucide-vue-next';

const density = useDensityStore();
</script>

<template>
  <div class="min-h-screen bg-[#0a0b10] text-[#f3f4f6] flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
    <!-- Cyberpunk Glassmorphism Navigation Bar -->
    <header class="sticky top-0 z-50 glass-panel border-b border-white/10 px-4 lg:px-8 py-3.5 backdrop-blur-xl">
      <div class="max-w-7xl mx-auto flex items-center justify-between">
        <!-- Brand Identity -->
        <div class="flex items-center gap-3">
          <div class="relative flex items-center justify-center w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500/20 to-violet-600/30 border border-cyan-400/40 shadow-[0_0_15px_rgba(0,242,254,0.3)]">
            <Shield class="w-5 h-5 text-cyan-400" />
            <span class="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75"></span>
              <span class="relative inline-flex rounded-full h-2.5 w-2.5 bg-cyan-500"></span>
            </span>
          </div>
          <div>
            <div class="flex items-center gap-2">
              <h1 class="text-lg font-bold tracking-wider uppercase bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-violet-400">
                SENTINEL
              </h1>
              <span class="text-[10px] font-semibold tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                v1.0
              </span>
            </div>
            <p class="text-[11px] text-gray-400 hidden sm:block">Discord Ecosystem & Telemetry Hub</p>
          </div>
        </div>

        <!-- System Controls & Mode Switcher -->
        <div class="flex items-center gap-4">
          <!-- Live Telemetry Status Pill -->
          <div class="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/40 border border-white/5 text-xs text-gray-300">
            <Radio class="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
            <span>Core Governor: <strong class="text-cyan-300 font-mono">24% CPU Target</strong></span>
          </div>

          <!-- Density Mode Switcher -->
          <DensityToggle />
        </div>
      </div>
    </header>

    <!-- Main Viewport Container (Density-driven) -->
    <main
      class="flex-1 transition-[max-width,padding] duration-300 ease-out"
      :class="[
        density.mode === 'immersive'
          ? 'max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8'
          : 'w-full px-3 sm:px-4 py-4 space-y-4'
      ]"
    >
      <slot>
        <!-- Router View with fallback shell when no route matched -->
        <router-view v-slot="{ Component }">
          <component :is="Component" v-if="Component" />
          <div v-else class="space-y-6">
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
        </router-view>
      </slot>
    </main>
  </div>
</template>
