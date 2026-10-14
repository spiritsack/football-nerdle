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

  test("does not show the next-puzzle countdown while playing", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("next-puzzle-countdown")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Play new daily" })).toHaveCount(0);
  });

  // Fixed past dates so the clock tests never create future daily_schedule rows.
  test("shows next-puzzle countdown on completed daily", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 1, 18, 0, 0) });
    await page.evaluate(() => {
      localStorage.setItem(
        "football-nerdle-daily-2026-10-01",
        JSON.stringify({ date: "2026-10-01", status: "won", attempts: 3 }),
      );
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Correct!" })).toBeVisible({ timeout: 10_000 });

    await page.clock.pauseAt(new Date(2026, 9, 1, 18, 0, 30));
    const countdown = page.getByTestId("next-puzzle-countdown");
    await expect(countdown).toHaveAttribute("role", "timer");
    await expect(countdown).not.toHaveAttribute("aria-live");
    await expect(countdown).toHaveText("Next puzzle in 05:59:30");

    const announcer = page.getByTestId("guess-announcer");
    const announced = await announcer.textContent();
    await page.clock.runFor(2000);
    await expect(countdown).toHaveText("Next puzzle in 05:59:28");
    await expect(announcer).toHaveText(announced ?? "");
  });

  test("replaces the countdown with a Play new daily button at midnight", async ({ page }) => {
    await page.clock.install({ time: new Date(2026, 9, 1, 23, 59, 55) });
    await page.evaluate(() => {
      localStorage.setItem(
        "football-nerdle-daily-2026-10-01",
        JSON.stringify({ date: "2026-10-01", status: "lost", attempts: 5 }),
      );
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId("next-puzzle-countdown")).toBeVisible();

    await page.clock.fastForward("00:10");
    await expect(page.getByText("New puzzle available!")).toBeVisible();
    await expect(page.getByTestId("next-puzzle-countdown")).toHaveCount(0);

    await page.getByRole("button", { name: "Play new daily" }).click();
    await expect(page).toHaveURL(/#\/guess$/);
    await expect(page.getByText(/Guess the Player — Daily #193/)).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Attempts:.*0.*\/.*5/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toHaveCount(0);
    await expect(page.getByTestId("next-puzzle-countdown")).toHaveCount(0);
  });

  test("shows data updated timestamp", async ({ page }) => {
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(page.getByText(/Data updated:/)).toBeVisible();
  });
});
