import { test, expect } from "./fixtures";

test.describe("Not found page", () => {
  test("unknown path shows not-found screen", async ({ page }) => {
    await page.goto("/#/this-does-not-exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Home" })).toBeVisible();
  });

  test("unknown nested path shows not-found screen", async ({ page }) => {
    await page.goto("/#/guess/nope");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Home" })).toBeVisible();
  });

  test("/pack route shows not-found screen", async ({ page }) => {
    await page.goto("/#/pack");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Home" })).toBeVisible();
  });

  test("Back to Home link returns to Home", async ({ page }) => {
    await page.goto("/#/this-does-not-exist");
    await page.getByRole("link", { name: "Back to Home" }).click();
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.getByRole("heading", { name: "Football Nerdle" })).toBeVisible();
  });

  test("known route does not show not-found", async ({ page }) => {
    await page.goto("/#/battle");
    await expect(page.getByRole("heading", { name: "Page not found" })).toHaveCount(0);
  });

  test("fits a 375px viewport without horizontal scroll", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.goto("/#/this-does-not-exist");
    await expect(page.getByRole("heading", { name: "Page not found" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to Home" })).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBe(0);
  });
});
