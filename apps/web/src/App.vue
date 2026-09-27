<script setup lang="ts">
import { useDensityStore } from './stores/density';
import DensityToggle from './components/DensityToggle.vue';
import { Shield, Radio } from 'lucide-vue-next';
import { ref, onMounted, onUnmounted } from 'vue';
import { getJson } from './api';

const density = useDensityStore();
const health = ref<{ status: string; memory: { rssMb: number } } | null>(null);
let healthTimer: ReturnType<typeof setInterval> | undefined;

async function refreshHealth() {
  try { health.value = await getJson('/api/health'); }
  catch { health.value = null; }
}

onMounted(() => {
  void refreshHealth();
  healthTimer = setInterval(() => { void refreshHealth(); }, 30_000);
});
onUnmounted(() => { if (healthTimer) clearInterval(healthTimer); });
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
            <span>API: <strong class="text-cyan-300 font-mono">{{ health?.status === 'ok' ? `Online · ${health.memory.rssMb} MB RAM` : 'Unavailable' }}</strong></span>
          </div>

          <!-- Density Mode Switcher -->
          <DensityToggle />
        </div>
      </div>
    </header>

    <!-- Main Viewport Container (Density-driven, instantaneous layout change for 60fps compliance) -->
    <main
      class="flex-1"
      :class="[
        density.mode === 'immersive'
          ? 'max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 space-y-8'
          : 'w-full px-3 sm:px-4 py-4 space-y-4'
      ]"
    >
      <slot>
        <router-view />
      </slot>
    </main>
  </div>
</template>
