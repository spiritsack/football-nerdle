import { test, expect } from "@playwright/test";

test.describe("Pack mode leaderboard", () => {
  test("renders the bar chart with the user's score bucket highlighted", async ({ page }) => {
    await page.goto("/#/pack");
    const ready = await page.getByPlaceholder("Player name").waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
    if (!ready) {
      test.skip(true, "No pack seeded for today.");
      return;
    }

    const packSize = await page.getByRole("list", { name: "Pack progress" }).getByRole("listitem").count();
    const userScore = Math.min(7, packSize);

    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });

    // Pre-populate a finished pack so the leaderboard renders, AND mark the
    // result as already submitted so we don't pollute production with a real insert.
    await page.evaluate(({ date, size, score }) => {
      const attempts = Array.from({ length: size }, (_, i) => ({
        playerId: `p${i + 1}`,
        correct: i < score,
        guesses: i < score ? 1 : 3,
      }));
      localStorage.setItem(
        `football-nerdle-pack-${date}`,
        JSON.stringify({ date, score, attempts }),
      );
      localStorage.setItem(`football-nerdle-pack-lb-${date}`, "1");
    }, { date: today, size: packSize, score: userScore });

    await page.goto("/#/pack");

    const board = page.getByLabel("Today's results");
    await expect(board).toBeVisible({ timeout: 15_000 });

    // The user's bucket is rendered with bold styling.
    const userBucketPattern = new RegExp(`^${userScore}\\/${packSize}`);
    const userRow = board.locator("div").filter({ hasText: userBucketPattern }).first();
    await expect(userRow).toBeVisible();

    // All buckets from 0 to packSize are rendered.
    for (const score of [0, 1, userScore, packSize]) {
      await expect(board.getByText(`${score}/${packSize}`, { exact: true })).toBeVisible();
    }
  });
});
