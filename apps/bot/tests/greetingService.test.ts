import { describe, it, expect } from 'vitest';
import { generateGreeting, getTimeOfDay, GREETING_POOLS } from '../src/services/voice/greetingService';

describe('greetingService', () => {
  describe('getTimeOfDay', () => {
    it('returns morning between 5:00 and 11:59', () => {
      const d = new Date('2026-10-13T08:00:00+07:00');
      expect(getTimeOfDay(d)).toBe('morning');
    });

    it('returns afternoon between 12:00 and 17:59', () => {
      const d = new Date('2026-10-13T14:30:00+07:00');
      expect(getTimeOfDay(d)).toBe('afternoon');
    });

    it('returns evening between 18:00 and 22:59', () => {
      const d = new Date('2026-10-13T20:00:00+07:00');
      expect(getTimeOfDay(d)).toBe('evening');
    });

    it('returns night between 23:00 and 4:59', () => {
      const d1 = new Date('2026-10-13T23:30:00+07:00');
      const d2 = new Date('2026-10-13T02:00:00+07:00');
      expect(getTimeOfDay(d1)).toBe('night');
      expect(getTimeOfDay(d2)).toBe('night');
    });
  });

  describe('generateGreeting', () => {
    it('uses custom template when mode is "custom" and customMessage is provided', () => {
      const result = generateGreeting({
        displayName: 'Kuro',
        mode: 'custom',
        customMessage: 'Chào mừng đại ca {user} vào phòng!'
      });
      expect(result).toBe('Chào mừng đại ca Kuro vào phòng!');
    });

    it('generates an anime/e-girl style greeting from pool containing the member displayName', () => {
      const result = generateGreeting({
        displayName: 'Sakura',
        mode: 'pool'
      });
      expect(result).toContain('Sakura');
      expect(result.length).toBeGreaterThan(10);
    });

    it('defaults to member fallback name when displayName is empty', () => {
      const result = generateGreeting({
        displayName: '',
        mode: 'pool'
      });
      expect(result).toContain('thành viên');
    });

    it('selects greetings across pool without throwing errors', () => {
      const names = ['Alice', 'Bob', 'Charlie'];
      for (const name of names) {
        const greeting = generateGreeting({ displayName: name });
        expect(greeting).toContain(name);
      }
    });
  });
});
