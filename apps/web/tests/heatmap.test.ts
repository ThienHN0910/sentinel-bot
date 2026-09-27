import { describe, it, expect } from 'vitest';
import { calculateHeatmapColor } from '../src/utils/heatmap';

describe('Heatmap Color Ratio', () => {
  it('returns faint background for 0 activity', () => {
    expect(calculateHeatmapColor(0, 100)).toBe('rgba(255, 255, 255, 0.05)');
  });

  it('scales alpha dynamically with intensity', () => {
    const col = calculateHeatmapColor(50, 100);
    expect(col).toContain('rgba(0, 242, 254, 0.6)');
  });
});
