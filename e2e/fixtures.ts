import { test as base, expect, type Locator, type Page, type Response } from "@playwright/test";

/**
 * One timeout for every wait on Supabase data (puzzle load, search results,
 * result screens). Cold CI runners plus sequential Supabase calls regularly
 * exceed the old ad-hoc 10s waits; UI-only assertions keep the 5s default.
 */
export const DATA_TIMEOUT = 30_000;

/**
 * Every test gets a guard that aborts writes to `daily_schedule`, so no test
 * can auto-insert a schedule row (the app does that when today has none).
 * Tests that need a daily puzzle use `mockDailySchedule` instead.
 */
export const test = base.extend<{ blockDailyScheduleWrites: void }>({
  blockDailyScheduleWrites: [
    async ({ page }, use) => {
      await page.route("**/rest/v1/daily_schedule*", (route) =>
        route.request().method() === "GET" ? route.fallback() : route.abort(),
      );
      await use();
    },
    { auto: true },
  ],
});

export { expect };

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
 * go to Supabase; writes are aborted by the auto guard on `test`.
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

// Mock TheSportsDB search responses
const MOCK_SEARCH_RESPONSES: Record<string, unknown> = {
  messi: {
    player: [
      {
        idPlayer: "34146370",
        strPlayer: "Lionel Messi",
        strThumb: "https://r2.thesportsdb.com/images/media/player/thumb/kpfsvp1725295651.jpg",
        strNationality: "Argentina",
        strSport: "Soccer",
        idTeam: "137699",
        strTeam: "Inter Miami",
        dateSigned: null,
      },
    ],
  },
  ronaldo: {
    player: [
      {
        idPlayer: "34146304",
        strPlayer: "Cristiano Ronaldo",
        strThumb: "https://r2.thesportsdb.com/images/media/player/thumb/bkre241600892282.jpg",
        strNationality: "Portugal",
        strSport: "Soccer",
        idTeam: "134509",
        strTeam: "Al-Nassr",
        dateSigned: null,
      },
    ],
  },
  neymar: {
    player: [
      {
        idPlayer: "34146371",
        strPlayer: "Neymar",
        strThumb: "https://r2.thesportsdb.com/images/media/player/thumb/j60pdx1741319053.jpg",
        strNationality: "Brazil",
        strSport: "Soccer",
        idTeam: null,
        strTeam: null,
        dateSigned: null,
      },
    ],
  },
};

export async function mockTheSportsDB(page: Page) {
  await page.route("**/thesportsdb.com/**", (route) => {
    const url = route.request().url();

    // Mock search endpoint
    if (url.includes("searchplayers.php")) {
      const match = url.match(/p=([^&]+)/);
      const query = match ? decodeURIComponent(match[1]).toLowerCase() : "";

      for (const [key, response] of Object.entries(MOCK_SEARCH_RESPONSES)) {
        if (query.includes(key)) {
          return route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(response),
          });
        }
      }

      // No match — return empty
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ player: null }),
      });
    }

    // Let other TheSportsDB requests through (former teams, player lookup)
    return route.continue();
  });
}
