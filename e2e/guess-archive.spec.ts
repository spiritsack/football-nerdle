import {
  test, expect, mockDailySchedule, loadPuzzle, seedStorage, todayString, DATA_TIMEOUT,
} from "./fixtures";

test.describe("Guess the Player Archive", () => {
  test("archive page is accessible from the daily game", async ({ page }) => {
    await mockDailySchedule(page, { date: todayString() });
    await page.goto("/#/guess");
    await expect(page.getByRole("main").getByRole("link", { name: "Archive" })).toBeVisible();
    await page.getByRole("main").getByRole("link", { name: "Archive" }).click();
    await expect(page).toHaveURL(/#\/guess\/archive/);
  });

  test("archive page shows header and back link", async ({ page }) => {
    await page.goto("/#/guess/archive");
    await expect(page.getByText("Past Daily Puzzles")).toBeVisible();
    await expect(page.getByRole("link", { name: /Today's Puzzle/ })).toBeVisible();
  });

  // The one test that reads the real daily_schedule table (read-only)
  test("archive page lists past days", async ({ page }) => {
    const schedule = page.waitForResponse(
      (r) => r.url().includes("/rest/v1/daily_schedule") && r.request().method() === "GET",
      { timeout: DATA_TIMEOUT },
    );
    await page.goto("/#/guess/archive");
    await schedule;
    // Should show at least one past day or "No past puzzles" message
    const pastDay = page.getByRole("button", { name: /Daily #\d+/ }).first();
    await expect(pastDay.or(page.getByText("No past puzzles yet."))).toBeVisible({ timeout: DATA_TIMEOUT });
    await expect(page.getByText("Loading...")).toHaveCount(0);
  });

  test("?day=1 loads archive mode with correct header", async ({ page }) => {
    await loadPuzzle(page, () => page.goto("/#/guess?day=1"), page.getByText(/Archive — Daily #1/));
  });

  test("shows the stats panel on an archive result screen", async ({ page }) => {
    // Seed a completed result for Daily #1 (2026-03-24) instead of playing it,
    // so the test does not submit to the leaderboard
    await seedStorage(page, {
      "football-nerdle-daily-2026-03-24": { date: "2026-03-24", status: "lost", attempts: 5 },
    });
    await loadPuzzle(page, () => page.goto("/#/guess?day=1"), page.getByRole("heading", { name: "Game Over!" }));
    await expect(page.getByTestId("guess-stats")).toContainText("Your Stats");
  });

  test("completed archive day does not show the next-puzzle countdown", async ({ page }) => {
    await seedStorage(page, {
      "football-nerdle-daily-2026-03-24": { date: "2026-03-24", status: "won", attempts: 2 },
    });
    await loadPuzzle(page, () => page.goto("/#/guess?day=1"), page.getByRole("heading", { name: "Correct!" }));
    await expect(page.getByText(/Archive — Daily #1/)).toBeVisible();
    await expect(page.getByTestId("next-puzzle-countdown")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play new daily" })).toHaveCount(0);
  });

  test("archive game shows Previous day button", async ({ page }) => {
    await loadPuzzle(page, () => page.goto("/#/guess?day=3"));
    await expect(page.getByRole("button", { name: /Previous day/ })).toBeVisible();
  });

  test("previous day navigation works", async ({ page }) => {
    await loadPuzzle(page, () => page.goto("/#/guess?day=3"), page.getByText(/Archive — Daily #3/));
    await loadPuzzle(
      page,
      () => page.getByRole("button", { name: /Previous day/ }).first().click(),
      page.getByText(/Archive — Daily #2/),
    );
  });

  test("?day=abc shows invalid day message", async ({ page }) => {
    await page.goto("/#/guess?day=abc");
    await expect(page.getByRole("alert")).toContainText("That isn't a valid day.");
    await expect(page.locator("header p")).toHaveText("Archive");
    await expect(page.getByRole("button", { name: "Play Today's Daily" })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("NaN");
    expect(bodyText).not.toContain("null");
  });

  test("?day=99999 shows day hasn't happened yet", async ({ page }) => {
    await page.goto("/#/guess?day=99999");
    await expect(page.getByRole("alert")).toContainText("This day hasn't happened yet.");
  });

  test("Try Again retries the same archive day after a failed load", async ({ page }) => {
    await page.route("**/rest/v1/**", (route) => route.abort());
    await page.goto("/#/guess?day=2");
    await expect(page.getByRole("alert")).toBeVisible({ timeout: DATA_TIMEOUT });
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();

    await page.unroute("**/rest/v1/**");
    await loadPuzzle(page, () => page.getByRole("button", { name: "Try Again" }).click());
    await expect(page.getByText(/Archive — Daily #2/)).toBeVisible();
  });

  // Overlapping loads: the Previous button is hidden while a puzzle loads, so the
  // newer load is started from the archive banner's "Play Today's Daily" button.
  test("a slow archive load does not overwrite a newer puzzle", async ({ page }) => {
    const day2 = "2026-03-25";
    const day3 = "2026-03-26";
    const stalePlayerId = "tm_28003";
    await mockDailySchedule(page, { date: [todayString(), day3] });
    await mockDailySchedule(page, { date: day2, playerId: stalePlayerId });

    // Hold back Daily #2's player row until the newer puzzle is on screen, so the
    // stale load resolves last (after its schedule read, right before it writes state)
    let release!: () => void;
    const released = new Promise<void>((resolve) => { release = resolve; });
    const isStalePlayer = (url: string) => url.includes("player_clubs") && url.includes(stalePlayerId);
    await page.route("**/rest/v1/players*", async (route) => {
      if (route.request().method() !== "GET" || !isStalePlayer(route.request().url())) return route.fallback();
      await released;
      await route.fallback();
    });

    await loadPuzzle(page, () => page.goto("/#/guess?day=3"), page.getByText(/Archive — Daily #3/));

    const heldRequest = page.waitForRequest(
      (r) => r.url().includes("/rest/v1/players") && isStalePlayer(r.url()),
      { timeout: DATA_TIMEOUT },
    );
    await page.getByRole("button", { name: /Previous day/ }).first().click();
    await heldRequest;

    await loadPuzzle(
      page,
      () => page.getByRole("button", { name: "Play Today's Daily" }).click(),
      page.getByText(/Guess the Player — Daily #\d+/),
    );

    // Let the stale Daily #2 load finish, then give React a frame to apply it
    const staleResponse = page.waitForResponse(
      (r) => r.url().includes("/rest/v1/players") && isStalePlayer(r.url()),
      { timeout: DATA_TIMEOUT },
    );
    release();
    await (await staleResponse).finished();
    await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => setTimeout(resolve, 0))));

    await expect(page.locator("header p")).toHaveText(/Guess the Player — Daily #\d+/);
    await expect(page.getByText(/This is an archived puzzle/)).toHaveCount(0);
    await expect(page.getByText("Club History")).toBeVisible();
  });

  test("daily game shows Archive link but no navigation arrows by default", async ({ page }) => {
    await mockDailySchedule(page, { date: todayString() });
    await loadPuzzle(page, () => page.goto("/#/guess"));
    await expect(page.getByRole("main").getByRole("link", { name: "Archive" })).toBeVisible();
    // No Next day arrow on today's daily
    await expect(page.getByRole("button", { name: /Next day/ })).not.toBeVisible();
  });
});
