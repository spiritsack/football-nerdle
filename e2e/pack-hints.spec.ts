import { test, expect } from "@playwright/test";

test.describe("Pack mode hints", () => {
  test("wrong guesses progressively reveal nationality then position", async ({ page }) => {
    await page.goto("/#/pack");

    const search = page.getByPlaceholder("Player name");
    const ready = await search.waitFor({ state: "visible", timeout: 15_000 }).then(() => true).catch(() => false);
    if (!ready) {
      test.skip(true, "No pack seeded for today.");
      return;
    }

    const hintsList = page.getByLabel("Hints");

    // No hints before any wrong guess.
    await expect(hintsList).toHaveCount(0);

    // Submit a wrong guess.
    await search.fill("Wayne Rooney");
    let option = page.getByRole("option").first();
    await option.waitFor({ state: "visible", timeout: 5_000 });
    await option.click();

    // If that was the answer we advance — skip rest.
    if (await page.getByText(/Player\s+2\s*\/\s*10/).isVisible()) {
      test.skip(true, "First guess matched the seeded player; can't exercise hint progression.");
      return;
    }

    // 1 wrong → nationality only.
    await expect(page.getByLabel("Hints").getByText("Nationality")).toBeVisible();
    await expect(page.getByLabel("Hints").getByText("Position")).toHaveCount(0);

    // 2nd wrong guess.
    await search.fill("Lionel Messi");
    option = page.getByRole("option").first();
    await option.waitFor({ state: "visible", timeout: 5_000 });
    await option.click();

    if (await page.getByText(/Player\s+2\s*\/\s*10/).isVisible()) {
      test.skip(true, "Second guess matched.");
      return;
    }

    await expect(page.getByLabel("Hints").getByText("Nationality")).toBeVisible();
    await expect(page.getByLabel("Hints").getByText("Position")).toBeVisible();
    await expect(page.getByLabel("Hints").getByText("Era at this club")).toHaveCount(0);
  });
});
