import { describe, it, expect } from 'vitest';
import { calculateLevel, calculateRequiredExp, STOP_WORDS } from '../src';

describe('Shared Package Constants & Formulas', () => {
  it('calculates required EXP correctly based on formula 100 * level^1.5', () => {
    expect(calculateRequiredExp(1)).toBe(100);
    expect(calculateRequiredExp(2)).toBe(282); // Math.floor(100 * 2^1.5) = 282
  });

  it('determines user level from cumulative EXP correctly', () => {
    expect(calculateLevel(0)).toBe(1);
    expect(calculateLevel(100)).toBe(1);
    expect(calculateLevel(282)).toBe(2);
  });

  it('contains essential Vietnamese and English stop-words', () => {
    expect(STOP_WORDS.has('là')).toBe(true);
    expect(STOP_WORDS.has('the')).toBe(true);
    expect(STOP_WORDS.has('và')).toBe(true);
  });
});
