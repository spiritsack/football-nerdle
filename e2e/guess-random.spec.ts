import { test, expect } from "@playwright/test";
import { mockTheSportsDB } from "./fixtures";

test.describe("Random Guess the Player", () => {
  test.beforeEach(async ({ page }) => {
    await mockTheSportsDB(page);
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("football-nerdle-guess-stats");
    });
  });

  test("loads a random player via ?mode=random", async ({ page }) => {
    await page.goto("/#/guess?mode=random");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
  });

  test("does not show daily header", async ({ page }) => {
    await page.goto("/#/guess?mode=random");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Daily #/)).not.toBeVisible();
  });

  test("announces a skip to screen readers", async ({ page }) => {
    await page.goto("/#/guess?mode=random");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    const announcer = page.getByTestId("guess-announcer");
    await expect(announcer).toHaveText("");

    await page.getByRole("button", { name: "Skip", exact: true }).click();
    await expect(announcer).toHaveText("Skipped. 4 attempts left.");
  });

  test("announces the loss after the final skip", async ({ page }) => {
    await page.goto("/#/guess?mode=random");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    const announcer = page.getByTestId("guess-announcer");

    for (let i = 1; i <= 5; i++) {
      await page.getByRole("button", { name: "Skip", exact: true }).click();
      if (i < 5) {
        const left = 5 - i;
        await expect(announcer).toHaveText(`Skipped. ${left} attempt${left === 1 ? "" : "s"} left.`);
      }
    }
    await expect(announcer).toHaveText(/^Out of attempts\. The player was .+\.$/);

    // Starting a new puzzle clears the region
    await page.getByRole("button", { name: "Random Game" }).click();
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(announcer).toHaveText("");
  });

  test("hides the stats panel on the random result screen", async ({ page }) => {
    await page.goto("/#/guess?mode=random");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });

    for (let i = 0; i < 5; i++) {
      await page.getByRole("button", { name: "Skip", exact: true }).click();
    }
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Random Game" })).toBeVisible();
    await expect(page.getByTestId("guess-stats")).toHaveCount(0);
    await expect(page.getByText("Your Stats")).toHaveCount(0);
  });
});
