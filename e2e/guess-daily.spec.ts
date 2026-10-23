import {
  test, expect, mockDailySchedule, loadPuzzle, DATA_TIMEOUT, searchFor, seedStorage, todayString, type Page,
} from "./fixtures";

const openDaily = (page: Page) => loadPuzzle(page, () => page.goto("/#/guess"));
const openDailyResult = (page: Page, heading: "Correct!" | "Game Over!") =>
  loadPuzzle(page, () => page.goto("/#/guess"), page.getByRole("heading", { name: heading }));

async function guessLewandowski(page: Page) {
  const option = page.getByRole("button", { name: /Lewandowski/ }).first();
  await searchFor(page.getByPlaceholder("Player name"), "lewandowski", option);
  await option.click();
}

test.describe("Daily Guess the Player", () => {
  test.beforeEach(async ({ page }) => {
    // Fixed daily puzzle (Mbappé) for today and the clock tests' dates, so no
    // test depends on, or creates, a shared daily_schedule row
    await mockDailySchedule(page, { date: [todayString(), "2026-10-01", "2026-10-02"] });
  });

  test("loads and shows club history", async ({ page }) => {
    await openDaily(page);
  });

  test("show-club-names toggle defaults to OFF", async ({ page }) => {
    await openDaily(page);
    const toggle = page.getByRole("switch", { name: /show club names/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  test("shows attempts counter", async ({ page }) => {
    await openDaily(page);
    await expect(page.getByText(/Attempts:.*0.*\/.*5/)).toBeVisible();
  });

  test("turning on show-club-names locks the toggle", async ({ page }) => {
    await openDaily(page);
    const toggle = page.getByRole("switch", { name: /show club names/i });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(toggle).toBeDisabled();
  });

  test("shows search input", async ({ page }) => {
    await openDaily(page);
    await expect(page.getByPlaceholder("Player name")).toBeVisible();
  });

  test("making a wrong guess increments attempts", async ({ page }) => {
    await openDaily(page);
    await guessLewandowski(page);
    await expect(page.getByText(/Attempts:.*1.*\/.*5/)).toBeVisible();
  });

  test("announces a wrong guess to screen readers", async ({ page }) => {
    await openDaily(page);
    const announcer = page.getByTestId("guess-announcer");
    await expect(announcer).toHaveAttribute("role", "status");
    await expect(announcer).toHaveAttribute("aria-live", "polite");
    await expect(announcer).toHaveClass(/sr-only/);
    await expect(announcer).toHaveText("");

    await guessLewandowski(page);
    await expect(announcer).toHaveText(/Wrong guess: .*Lewandowski.*4 attempts left\./);
  });

  test("does not announce anything for an already completed daily", async ({ page }) => {
    await seedStorage(page, {
      "football-nerdle-daily-{today}": { date: "{today}", status: "lost", attempts: 5 },
    });
    await openDailyResult(page, "Game Over!");
    await expect(page.getByTestId("guess-announcer")).toHaveText("");
    // Guess history isn't persisted, so no guess line on a re-opened result
    await expect(page.getByTestId("wrong-guesses")).toHaveCount(0);
  });

  test("shows the guess distribution empty state when nothing is recorded", async ({ page }) => {
    await seedStorage(page, {
      "football-nerdle-daily-{today}": { date: "{today}", status: "lost", attempts: 5 },
    });
    await openDailyResult(page, "Game Over!");
    const chart = page.getByTestId("guess-distribution");
    await expect(chart).toContainText("No daily wins recorded yet");
    await expect(chart.getByTestId("guess-distribution-count")).toHaveCount(0);
  });

  test("shows seeded guess distribution counts", async ({ page }) => {
    await seedStorage(page, {
      "football-nerdle-daily-{today}": { date: "{today}", status: "won", attempts: 3 },
      "football-nerdle-guess-distribution": { 1: 1, 2: 0, 3: 4, 4: 0, 5: 2 },
    });
    await openDailyResult(page, "Correct!");
    const chart = page.getByTestId("guess-distribution");
    await expect(chart).not.toContainText("No daily wins recorded yet");
    await expect(chart.getByTestId("guess-distribution-count")).toHaveText(["1", "0", "4", "0", "2"]);
    // Today's daily was won in 3 attempts, so row 3 is highlighted
    await expect(chart.getByTestId("guess-distribution-row-3").locator(".bg-pitch-500")).toHaveCount(1);
    await expect(chart.locator(".bg-pitch-500")).toHaveCount(1);
  });

  test("does not show the next-puzzle countdown while playing", async ({ page }) => {
    await openDaily(page);
    await expect(page.getByTestId("next-puzzle-countdown")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play new daily" })).toHaveCount(0);
  });

  // Fixed past dates; their daily_schedule reads are mocked in beforeEach.
  test("shows next-puzzle countdown on completed daily", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 1, 18, 0, 0) });
    await seedStorage(page, {
      "football-nerdle-daily-2026-10-01": { date: "2026-10-01", status: "won", attempts: 3 },
    });
    await openDailyResult(page, "Correct!");

    await page.clock.pauseAt(new Date(2026, 9, 1, 18, 0, 30));
    const countdown = page.getByTestId("next-puzzle-countdown");
    await expect(countdown).toHaveAttribute("role", "timer");
    await expect(countdown).not.toHaveAttribute("aria-live");
    await expect(countdown).toHaveText("Next puzzle in 05:59:30");

    const announcer = page.getByTestId("guess-announcer");
    const announced = await announcer.textContent();
    await page.clock.runFor(2000);
    await expect(countdown).toHaveText("Next puzzle in 05:59:28");
    await expect(announcer).toHaveText(announced ?? "");
  });

  test("replaces the countdown with a Play new daily button at midnight", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 1, 23, 59, 55) });
    // Re-applied on the "Play new daily" reload too; harmless, it is yesterday by then
    await seedStorage(page, {
      "football-nerdle-daily-2026-10-01": { date: "2026-10-01", status: "lost", attempts: 5 },
    });
    await openDailyResult(page, "Game Over!");
    await expect(page.getByTestId("next-puzzle-countdown")).toBeVisible();

    await page.clock.fastForward("00:10");
    await expect(page.getByText("New puzzle available!")).toBeVisible();
    await expect(page.getByTestId("next-puzzle-countdown")).toHaveCount(0);

    await loadPuzzle(page, () => page.getByRole("button", { name: "Play new daily" }).click());
    await expect(page).toHaveURL(/#\/guess$/);
    await expect(page.getByText(/Guess the Player — Daily #193/)).toBeVisible();
    await expect(page.getByText(/Attempts:.*0.*\/.*5/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toHaveCount(0);
    await expect(page.getByTestId("next-puzzle-countdown")).toHaveCount(0);
  });

  test("shows the stats panel on the daily result screen", async ({ page }) => {
    // A fresh context has no football-nerdle-guess-stats, so the panel shows zeros
    await seedStorage(page, {
      "football-nerdle-daily-{today}": { date: "{today}", status: "lost", attempts: 5 },
    });
    await openDailyResult(page, "Game Over!");
    const stats = page.getByTestId("guess-stats");
    await expect(stats).toBeVisible();
    await expect(stats).toContainText("Your Stats");
    await expect(stats.getByText("Win rate")).toHaveCount(0);
    // Random mode was removed: the daily result screen does not offer it
    await expect(page.getByRole("button", { name: "Share Result" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Random Game" })).toHaveCount(0);
  });

  test("?mode=random (old bookmark) loads today's daily", async ({ page }) => {
    await loadPuzzle(page, () => page.goto("/#/guess?mode=random"));
    await expect(page.getByText(/Guess the Player — Daily #\d+/)).toBeVisible();
  });

  test("shows data updated timestamp", async ({ page }) => {
    await openDaily(page);
    await expect(page.getByText(/Data updated:/)).toBeVisible();
  });
});

// No approved daily_schedule row for today: the first visitor's browser picks
// a seed player, and must only save and show one that can actually be played.
test.describe("Daily fallback when no player is scheduled", () => {
  const NO_ROW = { code: "PGRST116", details: "The result contains 0 rows", hint: null, message: "JSON object requested, multiple (or no) rows returned" };

  /** No row for today (PostgREST's `.single()` 406) and nothing used yet. Returns the captured insert bodies. */
  async function mockEmptySchedule(page: Page) {
    const inserted: { date: string; player_id: string }[] = [];
    const today = todayString();
    await page.route("**/rest/v1/daily_schedule*", async (route) => {
      const request = route.request();
      if (request.method() === "POST") {
        inserted.push(request.postDataJSON());
        return route.fallback(); // the blockDbWrites fixture records and stubs it
      }
      if (request.method() !== "GET") return route.fallback();
      const date = new URL(request.url()).searchParams.get("date");
      if (date === `eq.${today}`) {
        return route.fulfill({ status: 406, contentType: "application/json", body: JSON.stringify(NO_ROW) });
      }
      if (!date) return route.fulfill({ status: 200, contentType: "application/json", body: "[]" });
      return route.fallback();
    });
    return inserted;
  }

  /** Player-with-clubs lookups (`getFromCache`): `reject` decides which ones get no row. */
  async function mockPlayerLookups(
    page: Page,
    reject: (lookup: { id: string | null; name: string | null }) => boolean,
  ) {
    const lookedUpIds: string[] = [];
    await page.route("**/rest/v1/players*", (route) => {
      const url = new URL(route.request().url());
      if (route.request().method() !== "GET" || !url.searchParams.get("select")?.includes("player_clubs")) {
        return route.fallback();
      }
      const id = url.searchParams.get("id")?.replace(/^eq\./, "") ?? null;
      const name = url.searchParams.get("name")?.replace(/^ilike\./, "") ?? null;
      if (id) lookedUpIds.push(id);
      if (reject({ id, name })) {
        return route.fulfill({ status: 406, contentType: "application/json", body: JSON.stringify(NO_ROW) });
      }
      return route.fallback();
    });
    return lookedUpIds;
  }

  test("skips an unplayable fallback player", async ({ page, blockedWrites }) => {
    const inserted = await mockEmptySchedule(page);
    // The first candidate checked is rejected, by id and by its name lookup
    let rejectedId: string | null = null;
    let rejectedName: string | null = null;
    const lookedUpIds = await mockPlayerLookups(page, ({ id, name }) => {
      if (id && rejectedId === null) rejectedId = id;
      if (name && rejectedName === null) rejectedName = name;
      return (id !== null && id === rejectedId) || (name !== null && name === rejectedName);
    });

    await loadPuzzle(page, () => page.goto("/#/guess"));
    await expect(page.getByText(/Attempts:.*0.*\/.*5/)).toBeVisible();

    expect(rejectedId).not.toBeNull();
    expect(blockedWrites.filter((w) => w.url.includes("/rest/v1/daily_schedule"))).toHaveLength(1);
    expect(inserted).toHaveLength(1);
    expect(inserted[0].date).toBe(todayString());
    expect(inserted[0].player_id).not.toBe(rejectedId);
    // The saved player is one the fallback checked after the rejected one
    expect(lookedUpIds.slice(1)).toContain(inserted[0].player_id);
  });

  test("shows an error when no fallback player is playable", async ({ page, blockedWrites }) => {
    const inserted = await mockEmptySchedule(page);
    const lookedUpIds = await mockPlayerLookups(page, () => true);

    await page.goto("/#/guess");
    await expect(page.getByRole("alert")).toHaveText(
      "No puzzle is set up for today yet. Please try again later.", { timeout: DATA_TIMEOUT },
    );
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
    await expect(page.getByText("Club History")).toHaveCount(0);

    // At most five candidates are checked, and nothing is saved
    expect(new Set(lookedUpIds).size).toBe(5);
    expect(inserted).toHaveLength(0);
    expect(blockedWrites.filter((w) => w.url.includes("/rest/v1/daily_schedule"))).toHaveLength(0);
  });

  test("shows an error when today's scheduled player can't be loaded", async ({ page, blockedWrites }) => {
    // tm_0 is not a player in the database
    await mockDailySchedule(page, { date: todayString(), playerId: "tm_0" });

    await page.goto("/#/guess");
    await expect(page.getByRole("alert")).toHaveText(
      "Today's puzzle couldn't be loaded. Please try again.", { timeout: DATA_TIMEOUT },
    );
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
    // Never a random other player
    await expect(page.getByText("Club History")).toHaveCount(0);
    expect(blockedWrites.filter((w) => w.url.includes("/rest/v1/daily_schedule"))).toHaveLength(0);
  });

  test("shows an error when today's schedule can't be read", async ({ page, blockedWrites }) => {
    // Today's row is served (fixed player) once the read recovers
    await mockDailySchedule(page, { date: todayString() });
    // The first read of today's row fails with a 5xx, then reads go through
    const today = todayString();
    let failedReads = 0;
    await page.route("**/rest/v1/daily_schedule*", (route) => {
      const request = route.request();
      const date = new URL(request.url()).searchParams.get("date");
      if (request.method() === "GET" && date === `eq.${today}` && failedReads === 0) {
        failedReads++;
        return route.fulfill({
          status: 500, contentType: "application/json", body: JSON.stringify({ code: "XX000", message: "boom" }),
        });
      }
      return route.fallback();
    });

    await page.goto("/#/guess");
    await expect(page.getByRole("alert")).toHaveText(
      "Today's puzzle couldn't be loaded. Please try again.", { timeout: DATA_TIMEOUT },
    );
    await expect(page.getByText("Club History")).toHaveCount(0);
    // Not mistaken for "no row yet": nothing is picked or saved
    expect(failedReads).toBe(1);
    expect(blockedWrites.filter((w) => w.url.includes("/rest/v1/daily_schedule"))).toHaveLength(0);

    await loadPuzzle(page, () => page.getByRole("button", { name: "Try Again" }).click());
    await expect(page.getByText(/Attempts:.*0.*\/.*5/)).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
    expect(blockedWrites.filter((w) => w.url.includes("/rest/v1/daily_schedule"))).toHaveLength(0);
  });
});
