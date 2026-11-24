import type { Player } from "../types";

/** How many seed players the daily auto-pick checks before giving up. */
export const MAX_FALLBACK_ATTEMPTS = 5;

/** Once every seed is used, a repeat pick skips the players of this many most recent days. */
export const REPEAT_COOLDOWN_DAYS = 20;

export const NO_PUZZLE_MESSAGE = "No puzzle is set up for today yet. Please try again later.";
export const UNLOADABLE_PUZZLE_MESSAGE = "Today's puzzle couldn't be loaded. Please try again.";

/** PostgREST's error code when `.single()` finds no row. */
export const NO_ROWS_ERROR_CODE = "PGRST116";

/**
 * True only for PostgREST's "no rows" error, so a missing row can be told
 * apart from a failed read (5xx, timeout, network), which must not be treated
 * as "nothing scheduled".
 */
export function isNoRowsError(error: { code?: string } | null | undefined): boolean {
  return error?.code === NO_ROWS_ERROR_CODE;
}

/**
 * An error the daily loader must show to the player as-is, rather than
 * replacing it with the offline sequential fallback.
 */
export class DailyPuzzleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DailyPuzzleError";
  }
}

function shuffle<T>(items: T[], random: () => number): T[] {
  for (let i = items.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [items[i], items[j]] = [items[j], items[i]];
  }
  return items;
}

/**
 * The order in which the daily auto-pick tries seed players: the seeds not yet
 * used in `daily_schedule`, shuffled, or every seed shuffled once all are used.
 */
export function orderFallbackCandidates(
  seeds: Player[],
  usedIds: Set<string>,
  random: () => number = Math.random,
): Player[] {
  const unused = seeds.filter((p) => !usedIds.has(p.id));
  return shuffle(unused.length > 0 ? unused : [...seeds], random);
}

/**
 * Player ids to repeat once every seed has been used: anyone already in
 * `daily_schedule` except the players of the `cooldownDays` most recent days,
 * shuffled. If the history is no longer than the cooldown, nobody is excluded
 * (so the daily still has something to pick).
 */
export function orderRepeatCandidateIds(
  rows: { date: string; player_id: string }[],
  cooldownDays: number = REPEAT_COOLDOWN_DAYS,
  random: () => number = Math.random,
): string[] {
  const byRecency = [...rows].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const recent = new Set(byRecency.slice(0, cooldownDays).map((r) => r.player_id));
  const all = [...new Set(rows.map((r) => r.player_id))];
  const eligible = all.filter((id) => !recent.has(id));
  return shuffle(eligible.length > 0 ? eligible : all, random);
}

/**
 * Checks `candidates` in order and returns the first one `isPlayable` accepts.
 * A check that throws counts as not playable. Returns `null` once
 * `maxAttempts` checks have failed or the list runs out.
 */
export async function pickPlayableCandidate(
  candidates: Player[],
  isPlayable: (p: Player) => Promise<boolean>,
  maxAttempts: number,
): Promise<Player | null> {
  for (const candidate of candidates.slice(0, Math.max(0, maxAttempts))) {
    let ok = false;
    try {
      ok = await isPlayable(candidate);
    } catch {
      ok = false;
    }
    if (ok) return candidate;
  }
  return null;
}
