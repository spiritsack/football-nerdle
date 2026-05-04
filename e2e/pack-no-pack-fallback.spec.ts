import { test, expect } from "@playwright/test";

test.describe("Pack mode — no pack today fallback", () => {
  test.beforeEach(async ({ page }) => {
    // Force the pack_schedule query to return empty regardless of seed state.
    await page.route(/\/rest\/v1\/pack_schedule\?.*/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("renders friendly fallback with links to other modes", async ({ page }) => {
    await page.goto("/#/pack");

    const fallback = page.getByLabel("No pack today");
    await expect(fallback).toBeVisible({ timeout: 15_000 });
    await expect(fallback.getByText(/no pack today/i)).toBeVisible();

    // Links to other modes are present.
    await expect(fallback.getByRole("link", { name: "Guess the Player" })).toBeVisible();
    await expect(fallback.getByRole("link", { name: "Battle Mode" })).toBeVisible();
    await expect(fallback.getByRole("link", { name: "Home" })).toBeVisible();

    // The play UI is NOT shown.
    await expect(page.getByPlaceholder("Player name")).toHaveCount(0);
    await expect(page.getByLabel("Pack progress")).toHaveCount(0);
  });

  test("does not modify pack stats", async ({ page }) => {
    const seeded = {
      played: 5,
      totalScore: 38,
      bestScore: 9,
      streak: 4,
      longestStreak: 6,
      lastPlayedDate: "2026-04-30",
      lastSuccessDate: "2026-04-30",
    };

    await page.goto("/#/pack");
    await page.evaluate((s) => {
      localStorage.setItem("football-nerdle-pack-stats", JSON.stringify(s));
    }, seeded);

    await page.goto("/#/pack");
    await expect(page.getByLabel("No pack today")).toBeVisible({ timeout: 15_000 });

    const after = await page.evaluate(() =>
      JSON.parse(localStorage.getItem("football-nerdle-pack-stats") ?? "null"),
    );
    expect(after).toEqual(seeded);
  });
});
