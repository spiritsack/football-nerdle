import { test, expect } from "@playwright/test";

test.describe("Pack mode stats panel", () => {
  test("renders persisted stats on the finished screen", async ({ page }) => {
    await page.goto("/#/pack");
    const ready = await page.getByPlaceholder("Player name").waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
    if (!ready) {
      test.skip(true, "No pack seeded for today.");
      return;
    }

    const packSize = await page.getByRole("list", { name: "Pack progress" }).getByRole("listitem").count();
    const todayScore = Math.min(8, packSize);

    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });

    await page.evaluate(({ date, size, score }) => {
      localStorage.setItem(
        "football-nerdle-pack-stats",
        JSON.stringify({
          played: 5,
          totalScore: 38,
          bestScore: 9,
          streak: 4,
          longestStreak: 6,
          lastPlayedDate: date,
          lastSuccessDate: date,
        }),
      );
      const attempts = Array.from({ length: size }, (_, i) => ({
        playerId: `p${i + 1}`,
        correct: i < score,
        guesses: i < score ? 1 : 3,
      }));
      localStorage.setItem(
        `football-nerdle-pack-${date}`,
        JSON.stringify({ date, score, attempts }),
      );
    }, { date: today, size: packSize, score: todayScore });

    await page.goto("/#/pack");

    const stats = page.getByLabel("Pack stats");
    await expect(stats).toBeVisible({ timeout: 15_000 });
    await expect(stats.getByText("Played")).toBeVisible();
    await expect(stats.getByText("Streak")).toBeVisible();
    await expect(stats.getByText("Longest")).toBeVisible();

    // Persisted values are reflected.
    await expect(stats).toContainText("5");  // played
    await expect(stats).toContainText("9");  // best
    await expect(stats).toContainText("4");  // streak
    await expect(stats).toContainText("6");  // longest
    await expect(stats).toContainText(/Avg:\s*7\.6\s*\/\s*10/);
  });
});
