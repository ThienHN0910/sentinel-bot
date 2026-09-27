import { describe, it, expect } from 'vitest';
import { calculateSliceAngle } from '../src/utils/wheelMath';

describe('Wheel Angle Math', () => {
  it('divides circle evenly into radian slices', () => {
    const angle4 = calculateSliceAngle(4);
    expect(angle4).toBeCloseTo(Math.PI / 2);
  });
});
