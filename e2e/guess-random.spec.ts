import { test, expect, mockTheSportsDB, loadPuzzle, DATA_TIMEOUT, type Page } from "./fixtures";

const openRandom = (page: Page) => loadPuzzle(page, () => page.goto("/#/guess?mode=random"));
const attempts = (page: Page, n: number) => page.getByText(new RegExp(`Attempts:.*${n}.*/.*5`));

test.describe("Random Guess the Player", () => {
  test.beforeEach(async ({ page }) => {
    await mockTheSportsDB(page);
  });

  test("loads a random player via ?mode=random", async ({ page }) => {
    await openRandom(page);
  });

  test("does not show daily header", async ({ page }) => {
    await openRandom(page);
    await expect(page.getByText(/Daily #/)).not.toBeVisible();
  });

  test("Try Again retries a random game after a failed load", async ({ page }) => {
    await page.route("**/rest/v1/**", (route) => route.abort());
    await page.goto("/#/guess?mode=random");
    await expect(page.getByRole("alert")).toBeVisible({ timeout: DATA_TIMEOUT });
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();
    await expect(page.getByText(/Daily #/)).not.toBeVisible();

    await page.unroute("**/rest/v1/**");
    await loadPuzzle(page, () => page.getByRole("button", { name: "Try Again" }).click());
    await expect(page.getByText("Guess the Player", { exact: true })).toBeVisible();
    await expect(page.getByText(/Daily #/)).not.toBeVisible();
  });

  test("announces a skip to screen readers", async ({ page }) => {
    await openRandom(page);
    const announcer = page.getByTestId("guess-announcer");
    await expect(announcer).toHaveText("");

    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(attempts(page, 1)).toBeVisible();
    await expect(announcer).toHaveText("Skipped. 4 attempts left.");
  });

  test("announces the loss after the final skip", async ({ page }) => {
    await openRandom(page);
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
    // Random result screens have no next-puzzle countdown
    await expect(page.getByTestId("next-puzzle-countdown")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play new daily" })).toHaveCount(0);

    // Starting a new puzzle clears the region
    await loadPuzzle(page, () => page.getByRole("button", { name: "Random Game" }).click());
    await expect(attempts(page, 0)).toBeVisible();
    await expect(announcer).toHaveText("");
  });

  test("hides the stats panel on the random result screen", async ({ page }) => {
    await openRandom(page);

    const skip = page.getByRole("button", { name: "Skip", exact: true });
    for (let i = 1; i < 5; i++) {
      await skip.click();
      await expect(attempts(page, i)).toBeVisible();
    }
    await skip.click();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Random Game" })).toBeVisible();
    await expect(page.getByTestId("guess-stats")).toHaveCount(0);
    await expect(page.getByText("Your Stats")).toHaveCount(0);
  });
});
