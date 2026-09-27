import { describe, it, expect } from 'vitest';

export function calculateSliceAngle(totalSlices: number): number {
  if (totalSlices <= 0) return 0;
  return (2 * Math.PI) / totalSlices;
}

describe('Wheel Angle Math', () => {
  it('divides circle evenly into radian slices', () => {
    const angle4 = calculateSliceAngle(4);
    expect(angle4).toBeCloseTo(Math.PI / 2);
  });
});
