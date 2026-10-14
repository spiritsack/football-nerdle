import { test as base, expect, type Page } from "@playwright/test";

export { expect };
export type { Page };

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

/**
 * Shared `test` for every spec. An auto fixture stubs non-GET requests to the
 * tables above with an empty 201 (supabase-js treats that as a successful
 * `.insert()` without `.select()`) and records them in `blockedWrites`. Reads
 * and RPCs still reach the real database. Page-level routes (e.g. a spec that
 * aborts all `rest/v1` traffic) are matched first and still win.
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
        await context.route(`**/rest/v1/${table}*`, (route) => {
          const request = route.request();
          const method = request.method();
          if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
            return route.fallback();
          }
          blockedWrites.push({ method, url: request.url() });
          return route.fulfill({ status: 201, body: "" });
        });
      }
      await provide();
    },
    { auto: true },
  ],
});

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
