import type { Player } from "../../types";
import type { DayState } from "./types";

/**
 * Re-roll the suggestions for all open (unassigned, non-past) days from the
 * given pool of unused players. Assigned and past days are left untouched.
 * `random` is injectable for deterministic tests.
 */
export function reshuffleSuggestions(
  days: DayState[],
  pool: Player[],
  today: string,
  random: () => number = Math.random,
): DayState[] {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }

  let idx = 0;
  return days.map((day) => {
    if (day.date < today || day.assignedPlayer) return day;
    return { ...day, suggestion: shuffled[idx++] ?? null };
  });
}
