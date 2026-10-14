import { test as base, expect, type Locator, type Page, type Response } from "@playwright/test";

export { expect };
export type { Page };

/**
 * One timeout for every wait on Supabase data (puzzle load, search results,
 * result screens). Cold CI runners plus sequential Supabase calls regularly
 * exceed the old ad-hoc 10s waits; UI-only assertions keep the 5s default.
 */
export const DATA_TIMEOUT = 30_000;

export interface BlockedWrite {
  method: string;
  url: string;
}

/**
 * PostgREST tables the E2E suite must never write to. The CI dev server may
 * point at the production database, so inserts here would skew the live
 * leaderboard (`daily_results`) or pick/create real daily puzzles
 * (`daily_schedule`).
 */
export const BLOCKED_WRITE_TABLES = ["daily_results", "daily_schedule"] as const;

/** Multiplayer rooms table; stubbed separately so "Create Room" gets a row back. */
export const GAME_ROOMS_TABLE = "game_rooms";

type Route = Parameters<Parameters<Page["route"]>[1]>[0];

/**
 * Passes reads (GET/HEAD/OPTIONS) on to the next handler via `route.fallback()`
 * and returns `false`. For any other method it records the write in
 * `blockedWrites` and returns `true`: the caller must then fulfil the request
 * itself.
 */
async function interceptWrite(route: Route, blockedWrites: BlockedWrite[]): Promise<boolean> {
  const request = route.request();
  const method = request.method();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    await route.fallback();
    return false;
  }
  blockedWrites.push({ method, url: request.url() });
  return true;
}

/**
 * Shared `test` for every spec. An auto fixture stubs non-GET requests to the
 * tables above with an empty 201 (supabase-js treats that as a successful
 * `.insert()` without `.select()`) and records them in `blockedWrites`.
 * `game_rooms` writes are recorded too: a POST gets the inserted row echoed
 * back with a fake id (so `createRoom`'s `.select().single()` reaches the
 * waiting screen) and other writes get an empty 204. Reads and RPCs still
 * reach the real database. Page-level routes (e.g. a spec that aborts all
 * `rest/v1` traffic) are matched first and still win.
 */
export const test = base.extend<{ blockedWrites: BlockedWrite[]; blockDbWrites: void }>({
  // Playwright requires an object pattern here, even with no dependencies
  // eslint-disable-next-line no-empty-pattern
  blockedWrites: async ({}, provide) => {
    await provide([]);
  },
  blockDbWrites: [
    async ({ context, blockedWrites }, provide) => {
      for (const table of BLOCKED_WRITE_TABLES) {
        await context.route(`**/rest/v1/${table}*`, async (route) => {
          if (!(await interceptWrite(route, blockedWrites))) return;
          await route.fulfill({ status: 201, body: "" });
        });
      }
      await context.route(`**/rest/v1/${GAME_ROOMS_TABLE}*`, async (route) => {
        if (!(await interceptWrite(route, blockedWrites))) return;
        if (route.request().method() === "POST") {
          const body = route.request().postDataJSON() as Record<string, unknown>;
          await route.fulfill({
            status: 201,
            contentType: "application/json",
            body: JSON.stringify({
              id: crypto.randomUUID(),
              created_at: new Date().toISOString(),
              guest_id: null,
              ...body,
            }),
          });
          return;
        }
        // Updates resolve with data: null; a future turn-flow spec must add its own route.
        await route.fulfill({ status: 204, body: "" });
      });
      await provide();
    },
    { auto: true },
  ],
});

/** Today's date as the app computes it (local time, YYYY-MM-DD). */
export function todayString(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/**
 * Seed localStorage before the app boots, so a test needs a single `goto`.
 * `{today}` in a key or value is replaced in the browser with the page's local
 * date (which follows `page.clock` if it was installed first). A `null` value
 * removes the key. Runs again on every navigation and reload.
 */
export async function seedStorage(page: Page, items: Record<string, unknown>) {
  await page.addInitScript((entries) => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    for (const [rawKey, value] of entries) {
      const key = rawKey.replaceAll("{today}", today);
      if (value === null) localStorage.removeItem(key);
      else localStorage.setItem(key, value.replaceAll("{today}", today));
    }
  }, Object.entries(items).map(([k, v]) => [k, v === null ? null : JSON.stringify(v)] as [string, string | null]));
}

/**
 * Serve the daily puzzle for `date` (one or more) from a fixed player instead
 * of the shared `daily_schedule` table. The client reads it with `.single()`,
 * so the body is one object. Other schedule reads (archive list, other dates)
 * go to Supabase; writes are stubbed by the `blockDbWrites` auto fixture.
 */
export async function mockDailySchedule(
  page: Page,
  { date, playerId = "tm_342229" }: { date: string | string[]; playerId?: string },
) {
  const dates = new Set(Array.isArray(date) ? date : [date]);
  await page.route("**/rest/v1/daily_schedule*", (route) => {
    const request = route.request();
    const eqDate = new URL(request.url()).searchParams.get("date")?.replace(/^eq\./, "");
    if (request.method() === "GET" && eqDate && dates.has(eqDate)) {
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ player_id: playerId }),
      });
    }
    return route.fallback();
  });
}

/** A Supabase response carrying a full player row (club history included). */
function isPlayerResponse(response: Response): boolean {
  const url = response.url();
  return url.includes("/rest/v1/players") && url.includes("player_clubs") && response.request().method() === "GET";
}

/**
 * Run `trigger` (a goto, reload or click) and wait until the puzzle it loads is
 * on screen: first the player row response, then `loaded` (default: the
 * "Club History" card).
 */
export async function loadPuzzle(page: Page, trigger: () => Promise<unknown>, loaded?: Locator) {
  const response = page.waitForResponse(isPlayerResponse, { timeout: DATA_TIMEOUT });
  await trigger();
  await response;
  await expect(loaded ?? page.getByText("Club History")).toBeVisible({ timeout: DATA_TIMEOUT });
}

/** Type into a player search box and wait for the matching option (search hits Supabase). */
export async function searchFor(input: Locator, query: string, option: Locator) {
  await input.fill(query);
  await expect(option).toBeVisible({ timeout: DATA_TIMEOUT });
}
