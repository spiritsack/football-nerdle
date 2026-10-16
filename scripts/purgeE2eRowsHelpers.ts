/**
 * Pure helpers for scripts/purge-e2e-rows.ts.
 *
 * No Node or Supabase imports: src/__tests__/purgeE2eRows.test.ts imports this
 * file, so it is type-checked by tsconfig.app.json (browser lib, no node types).
 */

export interface Window {
  runId: number;
  start: Date;
  end: Date;
}

export type Matched<T> = T & { runId: number };

export interface SummaryEntry {
  date: string;
  attempts: number;
  count: number;
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || value === "") return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

/**
 * Parse the JSON printed by
 *   gh run list --workflow ci.yml --limit 1000 --json databaseId,createdAt,updatedAt
 * into one time window per run. Entries that are not objects, have no numeric
 * databaseId, or have a missing/unparseable createdAt/updatedAt are skipped.
 * Throws when the input is not an array.
 */
export function parseCiRuns(json: unknown): Window[] {
  if (!Array.isArray(json)) {
    throw new Error("CI runs file must contain a JSON array (output of gh run list --json databaseId,createdAt,updatedAt)");
  }

  const windows: Window[] = [];
  for (const entry of json) {
    if (typeof entry !== "object" || entry === null) continue;
    const { databaseId, createdAt, updatedAt } = entry as Record<string, unknown>;
    if (typeof databaseId !== "number" || !Number.isFinite(databaseId)) continue;
    const start = parseDate(createdAt);
    const end = parseDate(updatedAt);
    if (!start || !end) continue;
    windows.push({ runId: databaseId, start, end });
  }
  return windows;
}

/** Drop windows that start at or after `before` (the cutoff). Without `before`, keep all. */
export function filterWindows(windows: Window[], before?: Date): Window[] {
  if (!before) return [...windows];
  const cutoff = before.getTime();
  return windows.filter((w) => w.start.getTime() < cutoff);
}

/**
 * Return the rows whose created_at falls inside any [start - slack, end + slack]
 * window (inclusive), each tagged with the runId of the first matching window.
 * Rows with an unparseable created_at never match.
 */
export function matchRows<T extends { created_at: string }>(
  rows: T[],
  windows: Window[],
  slackMinutes = 2,
): Matched<T>[] {
  if (rows.length === 0 || windows.length === 0) return [];
  const slackMs = slackMinutes * 60_000;

  const matches: Matched<T>[] = [];
  for (const row of rows) {
    const created = parseDate(row.created_at);
    if (!created) continue;
    const t = created.getTime();
    const window = windows.find(
      (w) => t >= w.start.getTime() - slackMs && t <= w.end.getTime() + slackMs,
    );
    if (window) matches.push({ ...row, runId: window.runId });
  }
  return matches;
}

/** Count matches per (date, attempts), sorted by date then attempts. */
export function summarise<T extends { date: string; attempts: number }>(matches: T[]): SummaryEntry[] {
  const counts = new Map<string, SummaryEntry>();
  for (const { date, attempts } of matches) {
    const key = `${date}|${attempts}`;
    const entry = counts.get(key);
    if (entry) entry.count += 1;
    else counts.set(key, { date, attempts, count: 1 });
  }
  return [...counts.values()].sort((a, b) =>
    a.date === b.date ? a.attempts - b.attempts : a.date < b.date ? -1 : 1,
  );
}
