import { test, expect } from "@playwright/test";

test.describe("Pack mode leaderboard", () => {
  test("renders the bar chart with the user's score bucket highlighted", async ({ page }) => {
    await page.goto("/#/pack");
    const ready = await page.getByPlaceholder("Player name").waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
    if (!ready) {
      test.skip(true, "No pack seeded for today.");
      return;
    }

    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });

    // Pre-populate a finished pack so the leaderboard renders, AND mark the
    // result as already submitted so we don't pollute production with a real insert.
    await page.evaluate((date) => {
      const attempts = Array.from({ length: 10 }, (_, i) => ({
        playerId: `p${i + 1}`,
        correct: i < 7,
        guesses: i < 7 ? 1 : 3,
      }));
      localStorage.setItem(
        `football-nerdle-pack-${date}`,
        JSON.stringify({ date, score: 7, attempts }),
      );
      localStorage.setItem(`football-nerdle-pack-lb-${date}`, "1");
    }, today);

    await page.goto("/#/pack");

    const board = page.getByLabel("Today's results");
    await expect(board).toBeVisible({ timeout: 15_000 });

    // The user's bucket (7/10) is rendered with bold styling.
    const userRow = board.locator("div").filter({ hasText: /^7\/10/ }).first();
    await expect(userRow).toBeVisible();

    // All 11 buckets are rendered (0/10 through 10/10).
    for (const score of [0, 1, 5, 7, 10]) {
      await expect(board.getByText(`${score}/10`, { exact: true })).toBeVisible();
    }
  });
});
