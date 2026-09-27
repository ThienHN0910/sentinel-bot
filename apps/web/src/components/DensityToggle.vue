<script setup lang="ts">
import { useDensityStore } from '../stores/density';
import { LayoutGrid, Minimize2 } from 'lucide-vue-next';

const density = useDensityStore();
</script>

<template>
  <button
    @click="density.toggleMode"
    class="flex items-center gap-2 px-3.5 py-1.5 rounded-full glass-panel hover:border-cyan-400/50 transition duration-200 text-sm font-medium cursor-pointer select-none active:scale-95"
    :title="density.mode === 'immersive' ? 'Chuyển sang Chế độ Thu gọn' : 'Chuyển sang Chế độ Trực quan'"
  >
    <component :is="density.mode === 'immersive' ? LayoutGrid : Minimize2" class="w-4 h-4 text-cyan-400" />
    <span>{{ density.mode === 'immersive' ? 'Chế độ Trực quan' : 'Chế độ Thu gọn' }}</span>
  </button>
</template>
