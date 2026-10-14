import { test, expect } from "@playwright/test";
import { mockTheSportsDB } from "./fixtures";

test.describe("Guess the Player Archive", () => {
  test.beforeEach(async ({ page }) => {
    await mockTheSportsDB(page);
  });

  test("archive page is accessible from the daily game", async ({ page }) => {
    await page.goto("/#/guess");
    await expect(page.getByRole("link", { name: "Archive" })).toBeVisible();
    await page.getByRole("link", { name: "Archive" }).click();
    await expect(page).toHaveURL(/#\/guess\/archive/);
  });

  test("archive page shows header and back link", async ({ page }) => {
    await page.goto("/#/guess/archive");
    await expect(page.getByText("Past Daily Puzzles")).toBeVisible();
    await expect(page.getByRole("link", { name: /Today's Puzzle/ })).toBeVisible();
  });

  test("archive page lists past days", async ({ page }) => {
    await page.goto("/#/guess/archive");
    // Wait for entries to load
    await page.waitForTimeout(2000);
    // Should show at least one past day or "No past puzzles" message
    const hasDays = await page.locator("button").count() > 0;
    const hasEmpty = await page.getByText("No past puzzles yet.").isVisible();
    expect(hasDays || hasEmpty).toBe(true);
  });

  test("?day=1 loads archive mode with correct header", async ({ page }) => {
    await page.goto("/#/guess?day=1");
    await expect(page.getByText(/Archive — Daily #1/)).toBeVisible({ timeout: 10_000 });
  });

  test("archive game shows Previous day button", async ({ page }) => {
    await page.goto("/#/guess?day=3");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: /Previous day/ })).toBeVisible();
  });

  test("previous day navigation works", async ({ page }) => {
    await page.goto("/#/guess?day=3");
    await expect(page.getByText(/Archive — Daily #3/)).toBeVisible({ timeout: 10_000 });
    await page.getByRole("button", { name: /Previous day/ }).first().click();
    await expect(page.getByText(/Archive — Daily #2/)).toBeVisible({ timeout: 10_000 });
  });

  test("?day=abc shows invalid day message", async ({ page }) => {
    await page.goto("/#/guess?day=abc");
    await expect(page.getByRole("alert")).toContainText("That isn't a valid day.", { timeout: 10_000 });
    await expect(page.locator("header p")).toHaveText("Archive");
    await expect(page.getByRole("button", { name: "Play Today's Daily" })).toBeVisible();
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("NaN");
    expect(bodyText).not.toContain("null");
  });

  test("?day=99999 shows day hasn't happened yet", async ({ page }) => {
    await page.goto("/#/guess?day=99999");
    await expect(page.getByRole("alert")).toContainText("This day hasn't happened yet.", { timeout: 10_000 });
  });

  test("Try Again retries the same archive day after a failed load", async ({ page }) => {
    await page.route("**/rest/v1/**", (route) => route.abort());
    await page.goto("/#/guess?day=2");
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Try Again" })).toBeVisible();

    await page.unroute("**/rest/v1/**");
    await page.getByRole("button", { name: "Try Again" }).click();
    await expect(page.getByText(/Archive — Daily #2/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
  });

  test("daily game shows Archive link but no navigation arrows by default", async ({ page }) => {
    await page.goto("/#/guess");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("link", { name: "Archive" })).toBeVisible();
    // No Next day arrow on today's daily
    await expect(page.getByRole("button", { name: /Next day/ })).not.toBeVisible();
  });
});
