import { test, expect } from "@playwright/test";
import { mockTheSportsDB } from "./fixtures";

test.describe("Daily Guess the Player", () => {
  test.beforeEach(async ({ page }) => {
    await mockTheSportsDB(page);
    // Clear daily result so we get a fresh game
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("football-nerdle-daily-guess");
      localStorage.removeItem("football-nerdle-hard-mode-disabled");
      localStorage.removeItem("football-nerdle-guess-stats");
    });
    await page.goto("/#/guess");
  });

  test("loads and shows club history", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
  });

  test("show-club-names toggle defaults to OFF", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    const toggle = page.getByRole("switch", { name: /show club names/i });
    await expect(toggle).toBeVisible();
    await expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  test("shows attempts counter", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Attempts:.*0.*\/.*5/)).toBeVisible();
  });

  test("turning on show-club-names locks the toggle", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    const toggle = page.getByRole("switch", { name: /show club names/i });
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-checked", "true");
    await expect(toggle).toBeDisabled();
  });

  test("shows search input", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByPlaceholder("Player name")).toBeVisible();
  });

  test("making a wrong guess increments attempts", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });

    // Search and select a wrong player
    const searchInput = page.getByPlaceholder("Player name");
    await searchInput.fill("lewandowski");
    await page.getByRole("button", { name: /Lewandowski/ }).first().click();

    await expect(page.getByText(/Attempts:.*1.*\/.*5/)).toBeVisible();
  });

  test("shows data updated timestamp", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Data updated:/)).toBeVisible();
  });
});
