import type { Player } from "../types";

/** How many seed players the daily auto-pick checks before giving up. */
export const MAX_FALLBACK_ATTEMPTS = 5;

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
  const pool = unused.length > 0 ? unused : [...seeds];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool;
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
