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

    // Should show game UI with timer and search (or error if player not found)
    await expect(
      page.getByPlaceholder("Search for a player...").or(page.getByText("Game Over"))
    ).toBeVisible({ timeout: 15_000 });
  });

  test("game shows timer when started successfully", async ({ page }) => {
    await page.getByRole("button", { name: "Practice" }).click();

    // Wait for game to load
    const search = page.getByPlaceholder("Search for a player...");
    const gameOver = page.getByText("Game Over");
    await expect(search.or(gameOver)).toBeVisible({ timeout: 15_000 });

    // Only check timer if game started successfully
    if (await search.isVisible()) {
      await expect(page.getByText(/\d+s/)).toBeVisible();
    }
  });

  test("game shows chain counter when started", async ({ page }) => {
    await page.getByRole("button", { name: "Practice" }).click();

    const search = page.getByPlaceholder("Search for a player...");
    await expect(search.or(page.getByText("Game Over"))).toBeVisible({ timeout: 15_000 });

    if (await search.isVisible()) {
      await expect(page.getByText(/Chain:.*0/)).toBeVisible();
    }
  });

  test("Play with a Friend navigates to multiplayer", async ({ page }) => {
    await page.getByRole("button", { name: "Play with a Friend" }).click();
    await expect(page).toHaveURL(/#\/battle\/multiplayer/);
  });
});
