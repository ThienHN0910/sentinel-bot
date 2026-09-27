export function calculateHeatmapColor(value: number, max: number): string {
  if (value === 0) return 'rgba(255, 255, 255, 0.05)';
  const ratio = Math.min(value / max, 1);
  const alpha = parseFloat((0.2 + ratio * 0.8).toFixed(2));
  return `rgba(0, 242, 254, ${alpha})`;
}
