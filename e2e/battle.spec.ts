import { test, expect } from "@playwright/test";
import { mockTheSportsDB } from "./fixtures";

test.describe("Battle Mode", () => {
  test.beforeEach(async ({ page }) => {
    await mockTheSportsDB(page);
    await page.goto("/#/battle");
  });

  test("shows mode selection with Practice and Play with a Friend", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Practice" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play with a Friend" })).toBeVisible();
  });

  test("shows Battle Mode header", async ({ page }) => {
    await expect(page.getByText("Battle Mode")).toBeVisible();
  });

  test("shows back to home link", async ({ page }) => {
    await expect(page.getByText("Back to Home")).toBeVisible();
  });

  test("clicking Practice starts the game", async ({ page }) => {
    await page.getByRole("button", { name: "Practice" }).click();

    // Should show game UI with timer and search
    await expect(page.getByPlaceholder("Search for a player...")).toBeVisible({ timeout: 10_000 });
  });

  test("game shows timer counting down from 15", async ({ page }) => {
    await page.getByRole("button", { name: "Practice" }).click();
    // Wait for game to load before checking timer
    await expect(page.getByPlaceholder("Search for a player...")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("15s")).toBeVisible();

    // Wait a bit and check timer decreased
    await page.waitForTimeout(2000);
    await expect(page.getByText("15s")).not.toBeVisible();
  });

  test("game shows chain counter", async ({ page }) => {
    await page.getByRole("button", { name: "Practice" }).click();
    await expect(page.getByText(/Chain:.*0/)).toBeVisible({ timeout: 10_000 });
  });

  test("Play with a Friend navigates to multiplayer", async ({ page }) => {
    await page.getByRole("button", { name: "Play with a Friend" }).click();
    await expect(page).toHaveURL(/#\/battle\/multiplayer/);
  });
});
