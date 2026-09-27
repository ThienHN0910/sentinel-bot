export const BAU_CUA_ITEMS = ['BẦU', 'CUA', 'TÔM', 'CÁ', 'GÀ', 'NAI'] as const;
export type BauCuaItem = (typeof BAU_CUA_ITEMS)[number];

export function calculateBauCuaPayout(betItem: BauCuaItem, betAmount: number, rolled: string[]): number {
  const matches = rolled.filter((item) => item === betItem).length;
  if (matches === 0) return 0;
  return betAmount + betAmount * matches;
}

export class BauCuaGame {
  public static rollDice(): BauCuaItem[] {
    return [
      BAU_CUA_ITEMS[Math.floor(Math.random() * 6)],
      BAU_CUA_ITEMS[Math.floor(Math.random() * 6)],
      BAU_CUA_ITEMS[Math.floor(Math.random() * 6)]
    ];
  }

  public static roll(): BauCuaItem[] {
    return this.rollDice();
  }
}
