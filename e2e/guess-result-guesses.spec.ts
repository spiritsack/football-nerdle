import { test, expect, mockTheSportsDB, loadPuzzle, searchFor } from "./fixtures";

test.describe("Guess the Player result screen wrong guesses", () => {
  test.beforeEach(async ({ page }) => {
    await mockTheSportsDB(page);
    await loadPuzzle(page, () => page.goto("/#/guess?id=tm_349066"));
  });

  test("lists wrong guesses after losing and clears them for a new puzzle", async ({ page }) => {
    const wrongGuesses = page.getByTestId("wrong-guesses");
    await expect(wrongGuesses).toHaveCount(0);

    const lewandowski = page.getByRole("button", { name: /Lewandowski/ }).first();
    await searchFor(page.getByPlaceholder("Player name"), "lewandowski", lewandowski);
    await lewandowski.click();
    await expect(page.getByText(/Attempts:.*1.*\/.*5/)).toBeVisible();

    // While playing, the line appears after the first wrong guess
    await expect(wrongGuesses).toBeVisible();
    await expect(wrongGuesses).toHaveText(/^Wrong: .*Lewandowski/);

    const skip = page.getByRole("button", { name: "Skip", exact: true });
    for (let i = 2; i <= 5; i++) {
      await skip.click();
      if (i < 5) await expect(page.getByText(new RegExp(`Attempts:.*${i}.*/.*5`))).toBeVisible();
    }

    // Result screen keeps the list
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    await expect(wrongGuesses).toBeVisible();
    await expect(wrongGuesses).toHaveText(/^Wrong: .*Lewandowski/);

    // A new puzzle never shows the previous game's guesses
    await loadPuzzle(
      page,
      () => page.getByRole("button", { name: "Random Game" }).click(),
      page.getByText(/Attempts:.*0.*\/.*5/),
    );
    await expect(wrongGuesses).toHaveCount(0);
  });
});
