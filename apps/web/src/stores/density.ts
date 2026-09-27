import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useDensityStore = defineStore('density', () => {
  const mode = ref<'immersive' | 'compact'>('immersive');

  function toggleMode() {
    mode.value = mode.value === 'immersive' ? 'compact' : 'immersive';
  }

  return { mode, toggleMode };
});
