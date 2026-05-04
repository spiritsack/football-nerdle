import { test, expect } from "@playwright/test";

test.describe("Home page Pack card", () => {
  test("renders a Pack Mode card linking to /pack", async ({ page }) => {
    await page.goto("/");
    const card = page.getByRole("heading", { name: "Pack Mode" });
    await expect(card).toBeVisible();
    await expect(page.getByRole("link", { name: /Today's Pack/ })).toHaveAttribute("href", /#\/pack$/);
  });

  test("CTA shows completed state when today's pack result is stored", async ({ page }) => {
    await page.goto("/");
    const today = await page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    });
    await page.evaluate((date) => {
      localStorage.setItem(
        `football-nerdle-pack-${date}`,
        JSON.stringify({ date, score: 8, attempts: [] }),
      );
    }, today);

    await page.goto("/");
    await expect(page.getByRole("link", { name: /Pack \(Done\)/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /Today's Pack$/ })).toHaveCount(0);
  });
});
