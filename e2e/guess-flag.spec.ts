import { test, expect, mockTheSportsDB, loadPuzzle } from "./fixtures";

test.describe("Guess the Player nationality flag", () => {
  test.beforeEach(async ({ page }) => {
    await mockTheSportsDB(page);
    // Mbappé (France)
    await loadPuzzle(page, () => page.goto("/#/guess?id=tm_342229"));
  });

  test("no flag before reveal, even after the nationality hint", async ({ page }) => {
    await expect(page.getByTestId("nationality-flag")).toHaveCount(0);
    await page.getByRole("button", { name: "Skip" }).click();
    await expect(page.getByText(/Attempts:.*1.*\/.*5/)).toBeVisible();
    await expect(page.getByTestId("nationality-flag")).toHaveCount(0);
  });

  test("shows the flag next to the name once revealed", async ({ page }) => {
    const skip = page.getByRole("button", { name: "Skip" });
    for (let i = 1; i < 5; i++) {
      await skip.click();
      await expect(page.getByText(new RegExp(`Attempts:.*${i}.*/.*5`))).toBeVisible();
    }
    await skip.click();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    await expect(page.getByRole("img", { name: "France flag" })).toBeVisible();
  });
});
