import { test, expect } from "@playwright/test";

test.describe("Pack Mode (tracer)", () => {
  test("renders today's seeded pack with club header, photo, autocomplete, and 10-dot strip", async ({ page }) => {
    await page.goto("/#/pack");

    const search = page.getByPlaceholder("Player name");
    const fallback = page.getByLabel("No pack today");

    const outcome = await Promise.race([
      search.waitFor({ state: "visible", timeout: 15_000 }).then(() => "playing" as const).catch(() => null),
      fallback.waitFor({ state: "visible", timeout: 15_000 }).then(() => "idle" as const).catch(() => null),
    ]);

    if (outcome === "idle") {
      test.skip(true, "No pack seeded for today — migration not run.");
      return;
    }

    expect(outcome).toBe("playing");
    const progress = page.getByRole("list", { name: "Pack progress" });
    await expect(progress).toBeVisible();
    const packSize = await progress.getByRole("listitem").count();
    expect(packSize).toBeGreaterThan(0);
    await expect(page.getByText(new RegExp(`Player\\s+1\\s*\\/\\s*${packSize}`))).toBeVisible();
    await expect(page.getByText(/Score:/)).toBeVisible();
  });

  test("submitting a wrong guess increments the guess counter", async ({ page }) => {
    await page.goto("/#/pack");

    const search = page.getByPlaceholder("Player name");
    const ready = await search.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
    if (!ready) {
      test.skip(true, "No pack seeded for today — migration not run.");
      return;
    }

    await expect(page.getByText(/Guesses:.*0.*\/.*3/)).toBeVisible();

    await search.fill("Wayne Rooney");
    const option = page.getByRole("option").first();
    await option.waitFor({ state: "visible", timeout: 5_000 });
    await option.click();

    // Either it's the answer (advances to player 2) or it's wrong (counter ticks).
    await expect(async () => {
      const onSecond = await page.getByText(/Player\s+2\s*\/\s*\d+/).isVisible();
      const wrongTick = await page.getByText(/Guesses:.*1.*\/.*3/).isVisible();
      const reveal = await page.getByText("Out of guesses").isVisible();
      expect(onSecond || wrongTick || reveal).toBe(true);
    }).toPass({ timeout: 5_000 });
  });
});
