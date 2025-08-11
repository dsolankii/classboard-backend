// src/utils/dates.ts
export function parseDateOrNull(s?: string) {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// given a window [start, end], return the previous equal window
export function previousWindow(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime() + 1; // inclusive
  const prevEnd = new Date(start.getTime() - 1);
  const prevStart = new Date(prevEnd.getTime() - ms + 1);
  return { prevStart, prevEnd };
}

// safe percent change, rounded to 2 decimals
export function pct(curr: number, prev: number) {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return Math.round(((curr - prev) / prev) * 100 * 100) / 100;
}
