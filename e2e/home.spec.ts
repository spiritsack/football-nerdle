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

test.describe("How to play", () => {
  test("each mode card has a How to play button", async ({ page }) => {
    await page.goto("/#/");
    await expect(page.getByRole("button", { name: "How to play" })).toHaveCount(2);
  });

  test("Guess card opens Guess the Player rules with focus on Got it", async ({ page }) => {
    await page.goto("/#/");
    await page.getByRole("button", { name: "How to play" }).first().click();
    const dialog = page.getByRole("dialog", { name: "How to play: Guess the Player" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toContainText("5 attempts");
    await expect(page.getByRole("button", { name: "Got it" })).toBeFocused();
  });

  test("Battle card opens Battle Mode rules", async ({ page }) => {
    await page.goto("/#/");
    await page.getByRole("button", { name: "How to play" }).nth(1).click();
    const dialog = page.getByRole("dialog", { name: "How to play: Battle Mode" });
    await expect(dialog).toBeVisible();
    await expect(dialog).toHaveAttribute("aria-modal", "true");
    await expect(dialog).toContainText("15 seconds");
    await expect(page.getByRole("button", { name: "Got it" })).toBeFocused();
  });

  test("closes with Got it and does not navigate", async ({ page }) => {
    await page.goto("/#/");
    await page.getByRole("button", { name: "How to play" }).first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await expect(page).toHaveURL(/#\/$/);
    await page.getByRole("button", { name: "Got it" }).click();
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/#\/$/);
  });

  test("closes with Escape", async ({ page }) => {
    await page.goto("/#/");
    await page.getByRole("button", { name: "How to play" }).nth(1).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/#\/$/);
  });

  test("clicking inside the panel keeps it open, clicking the backdrop closes it", async ({ page }) => {
    await page.goto("/#/");
    await page.getByRole("button", { name: "How to play" }).first().click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    await dialog.getByRole("heading").click();
    await expect(dialog).toBeVisible();
    await page.getByTestId("how-to-play-backdrop").click({ position: { x: 5, y: 5 } });
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await expect(page).toHaveURL(/#\/$/);
  });
});
