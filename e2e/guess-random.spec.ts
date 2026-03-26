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
});
