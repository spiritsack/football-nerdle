import type { Player } from "../../types";
import type { DayState, ScheduleOp } from "./types";

/**
 * Move an item within a list from one index to another (pure).
 * Returns the input list unchanged for no-op or out-of-range moves.
 */
export function reorderList<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const result = [...list];
  const [moved] = result.splice(from, 1);
  result.splice(to, 0, moved);
  return result;
}

/**
 * Compute the new day states and the DB writes needed when a player is
 * dragged from one day onto another. Returns null when the move is not
 * allowed: past days and today are locked (matching the Clear-button rules),
 * and a suggestion cannot displace an assigned player.
 *
 * - assigned → assigned day: swap both schedule rows
 * - assigned → open day: move the row; the target's suggestion backfills the source day
 * - suggestion → open day: swap suggestions locally, no writes
 */
export function movePlayerBetweenDays(
  days: DayState[],
  sourceDate: string,
  targetDate: string,
  today: string,
): { days: DayState[]; ops: ScheduleOp[] } | null {
  if (sourceDate === targetDate) return null;
  if (sourceDate <= today || targetDate <= today) return null;
  const source = days.find((d) => d.date === sourceDate);
  const target = days.find((d) => d.date === targetDate);
  if (!source || !target) return null;

  if (source.assignedPlayer) {
    if (target.assignedPlayer) {
      return {
        days: days.map((d) => {
          if (d.date === sourceDate) return { ...d, assignedPlayer: target.assignedPlayer };
          if (d.date === targetDate) return { ...d, assignedPlayer: source.assignedPlayer };
          return d;
        }),
        ops: [
          { type: "upsert", date: targetDate, playerId: source.assignedPlayer.id },
          { type: "upsert", date: sourceDate, playerId: target.assignedPlayer.id },
        ],
      };
    }
    return {
      days: days.map((d) => {
        if (d.date === sourceDate) return { ...d, assignedPlayer: null, suggestion: target.suggestion };
        if (d.date === targetDate) return { ...d, assignedPlayer: source.assignedPlayer, suggestion: null };
        return d;
      }),
      ops: [
        { type: "upsert", date: targetDate, playerId: source.assignedPlayer.id },
        { type: "delete", date: sourceDate },
      ],
    };
  }

  if (!source.suggestion || target.assignedPlayer) return null;
  return {
    days: days.map((d) => {
      if (d.date === sourceDate) return { ...d, suggestion: target.suggestion };
      if (d.date === targetDate) return { ...d, suggestion: source.suggestion };
      return d;
    }),
    ops: [],
  };
}

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
