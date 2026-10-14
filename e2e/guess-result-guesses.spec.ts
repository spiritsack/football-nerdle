import { test, expect, mockTheSportsDB } from "./fixtures";

test.describe("Guess the Player result screen wrong guesses", () => {
  test.beforeEach(async ({ page }) => {
    await mockTheSportsDB(page);
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("football-nerdle-guess-stats");
    });
    await page.goto("/#/guess?id=tm_349066");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
  });

  test("lists wrong guesses after losing and clears them for a new puzzle", async ({ page }) => {
    const wrongGuesses = page.getByTestId("wrong-guesses");
    await expect(wrongGuesses).toHaveCount(0);

    await page.getByPlaceholder("Player name").fill("lewandowski");
    await page.getByRole("button", { name: /Lewandowski/ }).first().click();
    await expect(page.getByText(/Attempts:.*1.*\/.*5/)).toBeVisible();

    // While playing, the line appears after the first wrong guess
    await expect(wrongGuesses).toBeVisible();
    await expect(wrongGuesses).toHaveText(/^Wrong: .*Lewandowski/);

    const skip = page.getByRole("button", { name: "Skip", exact: true });
    for (let i = 0; i < 4; i++) {
      await skip.click();
    }

    // Result screen keeps the list
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    await expect(wrongGuesses).toBeVisible();
    await expect(wrongGuesses).toHaveText(/^Wrong: .*Lewandowski/);

    // A new puzzle never shows the previous game's guesses
    await page.getByRole("button", { name: "Random Game" }).click();
    await expect(page.getByText(/Attempts:.*0.*\/.*5/)).toBeVisible({ timeout: 10_000 });
    await expect(wrongGuesses).toHaveCount(0);
  });
});
