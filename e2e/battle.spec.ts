import { test, expect, loadPuzzle } from "./fixtures";

test.describe("Battle Mode", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/#/battle");
  });

  test("shows mode selection with Practice and Play with a Friend", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Practice" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Play with a Friend" })).toBeVisible();
  });

  test("shows Battle Mode header", async ({ page }) => {
    await expect(page.getByRole("main").getByText("Battle Mode")).toBeVisible();
  });

  test("shows back to home link", async ({ page }) => {
    await expect(page.getByText("Back to Home")).toBeVisible();
  });

  test("clicking Practice starts the game", async ({ page }) => {
    // Should show game UI with timer and search once the start player is loaded
    await loadPuzzle(
      page,
      () => page.getByRole("button", { name: "Practice" }).click(),
      page.getByPlaceholder("Search for a player..."),
    );
  });

  test("game shows timer counting down from 15", async ({ page }) => {
    await loadPuzzle(
      page,
      () => page.getByRole("button", { name: "Practice" }).click(),
      page.getByPlaceholder("Search for a player..."),
    );
    const timer = page.getByLabel(/seconds remaining/);
    await expect(timer).toHaveText("15s");

    // The timer moves off 15s within the default expect timeout
    await expect(timer).not.toHaveText("15s");
    await expect(timer).toHaveText(/^1[0-4]s$/);
  });

  test("game shows chain counter", async ({ page }) => {
    await loadPuzzle(
      page,
      () => page.getByRole("button", { name: "Practice" }).click(),
      page.getByText(/Chain:.*0/),
    );
  });

  test("Play with a Friend navigates to multiplayer", async ({ page }) => {
    await page.getByRole("button", { name: "Play with a Friend" }).click();
    await expect(page).toHaveURL(/#\/battle\/multiplayer/);
  });
});
