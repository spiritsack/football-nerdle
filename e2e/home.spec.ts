import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("shows the title", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Football Nerdle" })).toBeVisible();
  });

  test("shows Guess the Player card with Daily and Random buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Guess the Player" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Daily/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Random" })).toBeVisible();
  });

  test("shows Battle Mode card", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Battle Mode" })).toBeVisible();
  });

  test("Battle Mode card links to /battle", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("heading", { name: "Battle Mode" }).click();
    await expect(page).toHaveURL(/#\/battle$/);
  });

  test("Daily button links to /guess", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: /Daily/ }).click();
    await expect(page).toHaveURL(/#\/guess$/);
  });

  test("Random button links to /guess?mode=random", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Random" }).click();
    await expect(page).toHaveURL(/guess\?mode=random/);
  });

  test("Daily button is emphasised when daily not completed", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("football-nerdle-daily-guess"));
    await page.goto("/");
    const dailyBtn = page.getByRole("link", { name: /Daily/ });
    await expect(dailyBtn).toHaveClass(/bg-green-600/);
  });
});
