import { test, expect } from "@playwright/test";

test.describe("Pack mode score & share", () => {
  test("revisiting after completion shows the finished screen with N/10, day number, and emoji grid", async ({ page }) => {
    // First, load /pack to ensure migration is applied and a club name is available.
    await page.goto("/#/pack");
    const search = page.getByPlaceholder("Player name");
    const ready = await search.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
    if (!ready) {
      test.skip(true, "No pack seeded for today.");
      return;
    }

    // Inject a finished-state localStorage entry for today, then revisit.
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });

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
    }, today);

    await page.goto("/#/pack");

    // Finished screen appears in place of the play UI.
    await expect(page.getByText(/Pack #\d+/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("7/10")).toBeVisible();
    await expect(page.getByLabel("Result grid")).toContainText("✅");
    await expect(page.getByLabel("Result grid")).toContainText("❌");
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

    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });

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
    }, today);

    await page.goto("/#/pack");
    await page.getByRole("button", { name: /Share Result/ }).click();
    await expect(page.getByRole("button", { name: /Copied!/ })).toBeVisible();

    const text = await page.evaluate(() => navigator.clipboard.readText());
    expect(text).toMatch(/Football Nerdle Pack #\d+/);
    expect(text).toContain("7/10");
    expect(text).toContain("✅✅✅✅✅✅✅❌❌❌");
    expect(text).toContain("https://spiritsack.github.io/football-nerdle/#/pack");
  });
});
