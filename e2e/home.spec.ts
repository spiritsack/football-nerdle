import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("shows the title", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Football Nerdle" })).toBeVisible();
  });

  test("shows Battle Mode card", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Battle Mode" })).toBeVisible();
  });

  test("shows Daily Guess the Player card", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Daily Guess the Player" })).toBeVisible();
  });

  test("shows Random Guess the Player card", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Random Guess the Player" })).toBeVisible();
  });

  test("Battle Mode card links to /battle", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Battle Mode" }).click();
    await expect(page).toHaveURL(/#\/battle$/);
  });

  test("Daily Guess card links to /guess", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Daily Guess the Player" }).click();
    await expect(page).toHaveURL(/#\/guess$/);
  });

  test("Random Guess card links to /guess?mode=random", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Random Guess the Player" }).click();
    await expect(page).toHaveURL(/guess\?mode=random/);
  });
});
