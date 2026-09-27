export const STOP_WORDS = new Set([
  'là', 'và', 'của', 'có', 'được', 'cho', 'với', 'trong', 'đã', 'sẽ', 'thì',
  'mà', 'nhưng', 'đến', 'từ', 'vào', 'ở', 'đây', 'này', 'đó', 'kia', 'các',
  'những', 'một', 'người', 'cái', 'lại', 'cũng', 'như', 'ra', 'về', 'nào',
  'the', 'a', 'an', 'and', 'or', 'but', 'is', 'are', 'was', 'were', 'in', 'on', 'at'
]);

export function calculateRequiredExp(level: number): number {
  return Math.floor(100 * Math.pow(level, 1.5));
}

export function calculateLevel(totalExp: number): number {
  let level = 1;
  while (calculateRequiredExp(level + 1) <= totalExp) {
    level++;
  }
  return level;
}

export const XP_TABLE: number[] = Array.from({ length: 101 }, (_, i) => calculateRequiredExp(i));
