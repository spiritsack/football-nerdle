/**
 * Format a Date as `YYYY-MM-DD` using the local calendar day.
 * Use this (never `toISOString()`, which is UTC) whenever a Date needs to become a day.
 */
export function formatLocalDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Today's date (`YYYY-MM-DD`) in the player's local time. Shared by the game, Archive and Admin. */
export function getTodayString(): string {
  return formatLocalDate(new Date());
}

/**
 * Milliseconds from `now` until the local midnight that ends the `YYYY-MM-DD` day `today`.
 * Uses the local Date constructor, so the boundary matches getTodayString (and DST).
 * Returns 0 once that midnight has passed.
 */
export function getMsUntilNextDay(today: string, now: Date = new Date()): number {
  const [y, m, d] = today.split("-").map(Number);
  return Math.max(0, new Date(y, m - 1, d + 1).getTime() - now.getTime());
}
