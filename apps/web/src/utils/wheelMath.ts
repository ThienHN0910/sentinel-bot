export function calculateSliceAngle(totalSlices: number): number {
  if (totalSlices <= 0) return 0;
  return (2 * Math.PI) / totalSlices;
}
