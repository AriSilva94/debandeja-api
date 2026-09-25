export type StockLevel = 'ok' | 'low' | 'out';

export function levelFor(current: number, effectiveMin: number): StockLevel {
  if (current <= 0) return 'out';
  if (current < effectiveMin) return 'low';
  return 'ok';
}
