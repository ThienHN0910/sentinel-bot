import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDensityStore } from '../src/stores/density';

describe('Dashboard Density Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('toggles between immersive and compact modes', () => {
    const store = useDensityStore();
    expect(store.mode).toBe('immersive');
    store.toggleMode();
    expect(store.mode).toBe('compact');
  });
});
