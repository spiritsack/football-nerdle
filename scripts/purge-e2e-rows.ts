/**
 * Purge daily_results rows that past CI E2E runs wrote to production.
 *
 * Before the blockDbWrites fixture (e2e/fixtures.ts) existed, CI's E2E job ran
 * against production, so each finished daily game inserted a daily_results row
 * (skewing the community leaderboard) and each daily load could insert a
 * daily_schedule row. daily_results has no source marker, so the only signal is
 * a CI run's time window: rows whose created_at falls inside a run (plus a small
 * slack) are candidates. Real players who finished a game in that window match
 * too, so ALWAYS review the dry run before applying.
 *
 * daily_schedule rows are only reported ("review only, not deleted"): a past
 * row is the puzzle players actually saw that day and the archive relies on it.
 * Fix any of them by hand through the Admin schedule UI.
 *
 * Usage:
 *   npx tsx scripts/purge-e2e-rows.ts --runs runs.json [--before <ISO date>] [--apply]
 *
 * Environment variables:
 *   SUPABASE_URL               — Project URL (falls back to VITE_SUPABASE_URL)
 *   SUPABASE_SERVICE_ROLE_KEY  — Service role key (bypasses RLS; never commit it)
 *
 * Runbook (human with the service role key):
 *   1. Export the CI runs:
 *        gh run list --workflow ci.yml --limit 1000 \
 *          --json databaseId,createdAt,updatedAt > runs.json
 *   2. Find the merge time of the PR that added blockDbWrites (job 020), e.g.
 *        gh pr view <number> --json mergedAt
 *      and pass it as --before so later runs (which could not write) are ignored.
 *   3. Dry run against prod and review every listed row:
 *        npx tsx scripts/purge-e2e-rows.ts --runs runs.json --before <mergedAt>
 *   4. If the matches look right, rerun with --apply to delete them:
 *        npx tsx scripts/purge-e2e-rows.ts --runs runs.json --before <mergedAt> --apply
 *
 * Without --apply nothing is deleted.
 */

import { readFileSync } from "node:fs";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { filterWindows, matchRows, parseCiRuns, summarise, type Window } from "./purgeE2eRowsHelpers";

const USAGE = [
  "Usage: npx tsx scripts/purge-e2e-rows.ts --runs <runs.json> [--before <ISO date>] [--apply]",
  "",
  "Environment variables (required):",
  "  SUPABASE_URL (or VITE_SUPABASE_URL)",
  "  SUPABASE_SERVICE_ROLE_KEY",
  "",
  "Export runs.json with:",
  "  gh run list --workflow ci.yml --limit 1000 --json databaseId,createdAt,updatedAt > runs.json",
].join("\n");

const DELETE_BATCH_SIZE = 500;
const PAGE_SIZE = 1000;

interface DailyResultRow {
  id: number;
  date: string;
  attempts: number;
  created_at: string;
}

interface DailyScheduleRow {
  date: string;
  player_id: string;
  created_at: string;
}

function fail(message: string, showUsage = false): never {
  console.error(`ERROR: ${message}`);
  if (showUsage) console.error(`\n${USAGE}`);
  process.exit(1);
}

interface Args {
  runsFile?: string;
  before?: Date;
  apply: boolean;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { apply: false };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--apply") {
      args.apply = true;
    } else if (arg === "--runs") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) fail("--runs needs a file path", true);
      args.runsFile = value;
    } else if (arg === "--before") {
      const value = argv[++i];
      if (!value || value.startsWith("--")) fail("--before needs an ISO date", true);
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) fail(`--before is not a valid date: ${value}`, true);
      args.before = date;
    } else {
      fail(`Unknown argument: ${arg}`, true);
    }
  }
  return args;
}

function loadWindows(file: string): Window[] {
  let text: string;
  try {
    text = readFileSync(file, "utf8");
  } catch (err) {
    fail(`Cannot read runs file ${file}: ${(err as Error).message}`);
  }

  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (err) {
    fail(`Runs file ${file} is not valid JSON: ${(err as Error).message}`);
  }

  try {
    return parseCiRuns(json);
  } catch (err) {
    fail(`Runs file ${file}: ${(err as Error).message}`);
  }
}

async function fetchAll<T>(client: SupabaseClient, table: string, columns: string, orderBy: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from(table)
      .select(columns)
      .order(orderBy, { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`Failed to read ${table}: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...(data as unknown as T[]));
    from += PAGE_SIZE;
    if (data.length < PAGE_SIZE) break;
  }

  return rows;
}

async function deleteDailyResults(client: SupabaseClient, ids: number[]): Promise<number> {
  let deleted = 0;
  for (let i = 0; i < ids.length; i += DELETE_BATCH_SIZE) {
    const batch = ids.slice(i, i + DELETE_BATCH_SIZE);
    const { error } = await client.from("daily_results").delete().in("id", batch);
    if (error) {
      throw new Error(
        `Delete failed on batch ${Math.floor(i / DELETE_BATCH_SIZE) + 1} after ${deleted} rows deleted: ${error.message}`,
      );
    }
    deleted += batch.length;
  }
  return deleted;
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) fail("Missing SUPABASE_URL (or VITE_SUPABASE_URL) and/or SUPABASE_SERVICE_ROLE_KEY.", true);

  const args = parseArgs(process.argv.slice(2));
  if (!args.runsFile) fail("--runs <file> is required.", true);

  const allWindows = loadWindows(args.runsFile);
  const windows = filterWindows(allWindows, args.before);

  console.log("=== Purge E2E rows ===\n");
  console.log(`Project: ${url}`);
  console.log(`Mode:    ${args.apply ? "APPLY (matched daily_results rows will be deleted)" : "dry run"}`);
  console.log(`Runs:    ${allWindows.length} parsed, ${windows.length} used${args.before ? ` (before ${args.before.toISOString()})` : ""}\n`);

  const client = createClient(url, key);

  const results = await fetchAll<DailyResultRow>(client, "daily_results", "id, date, attempts, created_at", "id");
  const schedule = await fetchAll<DailyScheduleRow>(client, "daily_schedule", "date, player_id, created_at", "date");

  const resultMatches = matchRows(results, windows);
  const scheduleMatches = matchRows(schedule, windows);

  console.log(`daily_results: ${resultMatches.length} of ${results.length} rows match a CI run window`);
  for (const row of resultMatches) {
    console.log(`  id=${row.id}  date=${row.date}  attempts=${row.attempts}  created_at=${row.created_at}  run=${row.runId}`);
  }

  console.log("\nSummary (date, attempts: count):");
  const summary = summarise(resultMatches);
  if (summary.length === 0) console.log("  (none)");
  for (const entry of summary) {
    console.log(`  ${entry.date}  attempts=${entry.attempts}: ${entry.count}`);
  }

  console.log(`\ndaily_schedule (review only, not deleted): ${scheduleMatches.length} of ${schedule.length} rows match`);
  for (const row of scheduleMatches) {
    console.log(`  date=${row.date}  player_id=${row.player_id}  created_at=${row.created_at}  run=${row.runId}`);
  }

  if (!args.apply) {
    console.log("\nDry run: nothing deleted");
    return;
  }

  const deleted = await deleteDailyResults(
    client,
    resultMatches.map((row) => row.id),
  );
  console.log(`\nDeleted ${deleted} daily_results rows`);
}

main().catch((err: unknown) => {
  console.error(`ERROR: ${err instanceof Error ? err.message : String(err)}`);
  process.exit(1);
});
