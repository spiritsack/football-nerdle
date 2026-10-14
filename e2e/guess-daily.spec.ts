import {
  test, expect, mockDailySchedule, loadPuzzle, searchFor, seedStorage, todayString, type Page,
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
    await expect(chart.getByTestId("guess-distribution-row-3").locator(".bg-green-500")).toHaveCount(1);
    await expect(chart.locator(".bg-green-500")).toHaveCount(1);
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
