import { test, expect } from "@playwright/test";
import { mockTheSportsDB } from "./fixtures";

test.describe("Guess the Player nationality flag", () => {
  test.beforeEach(async ({ page }) => {
    await mockTheSportsDB(page);
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("football-nerdle-guess-stats");
    });
    // Mbappé (France)
    await page.goto("/#/guess?id=tm_342229");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
  });

  test("no flag before reveal, even after the nationality hint", async ({ page }) => {
    await expect(page.getByTestId("nationality-flag")).toHaveCount(0);
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByText(/Attempts:.*1.*\/.*5/)).toBeVisible();
    await expect(page.getByTestId("nationality-flag")).toHaveCount(0);
  });

  test("shows the flag next to the name once revealed", async ({ page }) => {
    const skip = page.getByRole("button", { name: "Skip" });
    for (let i = 0; i < 5; i++) {
      await skip.click();
    }
    await expect(page.getByRole("img", { name: "France flag" })).toBeVisible();
  });
});
