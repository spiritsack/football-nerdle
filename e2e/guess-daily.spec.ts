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
      localStorage.removeItem("football-nerdle-guess-distribution");
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

  test("announces a wrong guess to screen readers", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    const announcer = page.getByTestId("guess-announcer");
    await expect(announcer).toHaveAttribute("role", "status");
    await expect(announcer).toHaveAttribute("aria-live", "polite");
    await expect(announcer).toHaveClass(/sr-only/);
    await expect(announcer).toHaveText("");

    const searchInput = page.getByPlaceholder("Player name");
    await searchInput.fill("lewandowski");
    await page.getByRole("button", { name: /Lewandowski/ }).first().click();

    await expect(announcer).toHaveText(/Wrong guess: .*Lewandowski.*4 attempts left\./);
  });

  test("does not announce anything for an already completed daily", async ({ page }) => {
    await page.evaluate(() => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      localStorage.setItem(
        `football-nerdle-daily-${today}`,
        JSON.stringify({ date: today, status: "lost", attempts: 5 }),
      );
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("guess-announcer")).toHaveText("");
  });

  test("shows the guess distribution empty state when nothing is recorded", async ({ page }) => {
    await page.evaluate(() => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      localStorage.setItem(
        `football-nerdle-daily-${today}`,
        JSON.stringify({ date: today, status: "lost", attempts: 5 }),
      );
      localStorage.removeItem("football-nerdle-guess-distribution");
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible({ timeout: 10_000 });
    const chart = page.getByTestId("guess-distribution");
    await expect(chart).toContainText("No daily wins recorded yet");
    await expect(chart.getByTestId("guess-distribution-count")).toHaveCount(0);
  });

  test("shows seeded guess distribution counts", async ({ page }) => {
    await page.evaluate(() => {
      const d = new Date();
      const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      localStorage.setItem(
        `football-nerdle-daily-${today}`,
        JSON.stringify({ date: today, status: "won", attempts: 3 }),
      );
      localStorage.setItem(
        "football-nerdle-guess-distribution",
        JSON.stringify({ 1: 1, 2: 0, 3: 4, 4: 0, 5: 2 }),
      );
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Correct!" })).toBeVisible({ timeout: 10_000 });
    const chart = page.getByTestId("guess-distribution");
    await expect(chart).not.toContainText("No daily wins recorded yet");
    await expect(chart.getByTestId("guess-distribution-count")).toHaveText(["1", "0", "4", "0", "2"]);
    // Today's daily was won in 3 attempts, so row 3 is highlighted
    await expect(chart.getByTestId("guess-distribution-row-3").locator(".bg-green-500")).toHaveCount(1);
    await expect(chart.locator(".bg-green-500")).toHaveCount(1);
  });

  test("shows data updated timestamp", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Data updated:/)).toBeVisible();
  });
});
