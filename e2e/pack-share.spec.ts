import { test, expect } from "@playwright/test";

test.describe("Pack mode score & share", () => {
  test("revisiting after completion shows the finished screen with N/pack-size, day number, and emoji grid", async ({ page }) => {
    // First, load /pack to ensure migration is applied and a club name is available.
    await page.goto("/#/pack");
    const search = page.getByPlaceholder("Player name");
    const ready = await search.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
    if (!ready) {
      test.skip(true, "No pack seeded for today.");
      return;
    }

    const packSize = await page.getByRole("list", { name: "Pack progress" }).getByRole("listitem").count();
    const userScore = Math.min(7, packSize);

    // Inject a finished-state localStorage entry for today, then revisit.
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });

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
    }, { date: today, size: packSize, score: userScore });

    await page.goto("/#/pack");

    // Finished screen appears in place of the play UI.
    await expect(page.getByText(/Pack #\d+/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(new RegExp(`${userScore}\\/${packSize}`)).first()).toBeVisible();
    await expect(page.getByLabel("Result grid")).toContainText("✅");
    if (userScore < packSize) {
      await expect(page.getByLabel("Result grid")).toContainText("❌");
    }
    await expect(page.getByRole("button", { name: /Share Result/ })).toBeVisible();

    // Search input is no longer present.
    await expect(page.getByPlaceholder("Player name")).toHaveCount(0);
  });

  test("share button copies a formatted share string to the clipboard", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

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
    }, { date: today, size: packSize, score: userScore });

    await page.goto("/#/pack");
    await page.getByRole("button", { name: /Share Result/ }).click();
    await expect(page.getByRole("button", { name: /Copied!/ })).toBeVisible();

    const expectedGrid = "✅".repeat(userScore) + "❌".repeat(packSize - userScore);
    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/Football Nerdle Pack #\d+/);
    expect(text).toContain(`${userScore}/${packSize}`);
    expect(text).toContain(expectedGrid);
    expect(text).toContain("https://spiritsack.github.io/football-nerdle/#/pack");
  });
});
