import { test, expect, loadPuzzle, mockDailySchedule, todayString, DATA_TIMEOUT, type Page } from "./fixtures";

// The ?id= debug load: a fixed player, outside Daily and Archive
const DEBUG_URL = "/#/guess?id=tm_342229";
const openDebug = (page: Page) => loadPuzzle(page, () => page.goto(DEBUG_URL));
const attempts = (page: Page, n: number) => page.getByText(new RegExp(`Attempts:.*${n}.*/.*5`));

async function skipToLoss(page: Page) {
  const skip = page.getByRole("button", { name: "Skip", exact: true });
  for (let i = 1; i < 5; i++) {
    await skip.click();
    await expect(attempts(page, i)).toBeVisible();
  }
  await skip.click();
  await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
}

test.describe("Debug (?id=) Guess the Player", () => {
  test("does not show daily header", async ({ page }) => {
    await openDebug(page);
    await expect(page.getByText(/Daily #/)).not.toBeVisible();
  });

  test("Try Again retries the same ?id= load after a failed load", async ({ page }) => {
    await page.route("**/rest/v1/**", (route) => route.abort());
    await page.goto(DEBUG_URL);
    await expect(page.getByRole("alert")).toBeVisible({ timeout: DATA_TIMEOUT });
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
    await expect(page.getByText(/Daily #/)).not.toBeVisible();
    await expect(page.getByRole("button", { name: "Play Today's Daily" })).toHaveCount(0);

    await page.unroute("**/rest/v1/**");
    const retried = page.waitForRequest((req) => req.url().includes("/rest/v1/players") && req.url().includes("tm_342229"));
    await loadPuzzle(page, () => page.getByRole("button", { name: "Try Again" }).click());
    await retried;
    await expect(page.getByText("Guess the Player", { exact: true })).toBeVisible();
    await expect(page.getByText(/Daily #/)).not.toBeVisible();
  });

  test("announces a skip to screen readers", async ({ page }) => {
    await openDebug(page);
    const announcer = page.getByTestId("guess-announcer");
    await expect(announcer).toHaveText("");

    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(attempts(page, 1)).toBeVisible();
    await expect(announcer).toHaveText("Skipped. 4 attempts left.");
  });

  test("announces the loss after the final skip", async ({ page }) => {
    await openDebug(page);
    const announcer = page.getByTestId("guess-announcer");
    const skip = page.getByRole("button", { name: "Skip", exact: true });

    for (let i = 1; i < 5; i++) {
      await skip.click();
      await expect(attempts(page, i)).toBeVisible();
      const left = 5 - i;
      await expect(announcer).toHaveText(`Skipped. ${left} attempt${left === 1 ? "" : "s"} left.`);
    }
    await skip.click();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    await expect(announcer).toHaveText(/^Out of attempts\. The player was .+\.$/);
    // Skips are not guesses: no empty "Wrong:" line on the result screen
    await expect(page.getByTestId("wrong-guesses")).toHaveCount(0);
    // Non-daily result screens have no next-puzzle countdown
    await expect(page.getByTestId("next-puzzle-countdown")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play new daily" })).toHaveCount(0);
  });

  test("hides the stats panel on the debug result screen", async ({ page }) => {
    await openDebug(page);
    await skipToLoss(page);
    await expect(page.getByTestId("guess-stats")).toHaveCount(0);
    await expect(page.getByText("Your Stats")).toHaveCount(0);
  });

  test("debug result screen offers Play Today's Daily", async ({ page }) => {
    // Today's daily is a different player, so clicking fetches a new player row
    await mockDailySchedule(page, { date: todayString(), playerId: "tm_349066" });
    await openDebug(page);
    const playToday = page.getByRole("button", { name: "Play Today's Daily" });

    const skip = page.getByRole("button", { name: "Skip", exact: true });
    for (let i = 1; i < 5; i++) {
      await skip.click();
      await expect(attempts(page, i)).toBeVisible();
    }
    // Not offered while the debug puzzle is still being played
    await expect(playToday).toHaveCount(0);

    await skip.click();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Share Result" })).toBeVisible();
    await expect(playToday).toBeVisible();

    await loadPuzzle(page, () => playToday.click(), attempts(page, 0));
    expect(new URL(page.url()).hash).toBe("#/guess");
    await expect(page.getByText(/Guess the Player — Daily #\d+/)).toBeVisible();
    await expect(playToday).toHaveCount(0);
  });
});
