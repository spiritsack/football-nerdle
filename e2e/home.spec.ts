import { test, expect } from "@playwright/test";

test.describe("Home Page", () => {
  test("shows the title", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Football Nerdle" })).toBeVisible();
  });

  test("shows Guess the Player card with Daily and Archive buttons", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Guess the Player" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Daily/ })).toBeVisible();
    await expect(page.getByRole("link", { name: "Archive" })).toBeVisible();
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

  test("Archive button links to /guess/archive", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Archive" }).click();
    await expect(page).toHaveURL(/#\/guess\/archive$/);
  });

  test("Daily button is emphasised when daily not completed", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.removeItem("football-nerdle-daily-guess"));
    await page.goto("/");
    const dailyBtn = page.getByRole("link", { name: /Daily/ });
    await expect(dailyBtn).toHaveClass(/bg-green-600/);
    await expect(page.getByRole("link", { name: "Archive" })).toHaveClass(/bg-gray-700/);
  });

  test("Archive button is emphasised once daily is completed", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      const d = new Date();
      const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      localStorage.setItem("football-nerdle-daily-guess", JSON.stringify({ date }));
    });
    await page.goto("/");
    await expect(page.getByRole("link", { name: "Daily (Done)" })).toHaveClass(/bg-gray-700/);
    await expect(page.getByRole("link", { name: "Archive" })).toHaveClass(/bg-green-600/);
  });

  test("does not show the Pack Mode card", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Battle Mode" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Pack Mode" })).toHaveCount(0);
    await expect(page.getByRole("link", { name: /Today's Pack|Pack \(Done\)/ })).toHaveCount(0);
  });
});
