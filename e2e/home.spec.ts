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

test.describe("Daily summary", () => {
  async function seed(
    page: import("@playwright/test").Page,
    result: { status: "won" | "lost"; attempts: number } | null,
    streak: number,
  ) {
    await page.goto("/");
    await page.evaluate(
      ({ result, streak }) => {
        const d = new Date();
        const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        localStorage.removeItem("football-nerdle-daily-guess");
        localStorage.removeItem(`football-nerdle-daily-${date}`);
        if (result) {
          localStorage.setItem(`football-nerdle-daily-${date}`, JSON.stringify({ date, ...result }));
        }
        localStorage.setItem(
          "football-nerdle-guess-stats",
          JSON.stringify({ played: 5, won: 4, lost: 1, streak, longestStreak: 4, lastPlayedDate: date }),
        );
      },
      { result, streak },
    );
    await page.goto("/");
  }

  test("shows solved summary with streak", async ({ page }) => {
    await seed(page, { status: "won", attempts: 3 }, 4);
    await expect(page.getByTestId("daily-summary")).toHaveText("Solved in 3/5 · 🔥 4-day streak");
    await expect(page.getByRole("link", { name: "Daily (Done)" })).toBeVisible();
  });

  test("shows missed summary", async ({ page }) => {
    await seed(page, { status: "lost", attempts: 5 }, 0);
    await expect(page.getByTestId("daily-summary")).toHaveText("Missed today");
  });

  test("no summary when daily not played", async ({ page }) => {
    await seed(page, null, 4);
    await expect(page.getByRole("link", { name: "Daily Challenge" })).toBeVisible();
    await expect(page.getByTestId("daily-summary")).toHaveCount(0);
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

test.describe("Meta tags", () => {
  const SITE_URL = "https://spiritsack.github.io/football-nerdle/";
  const OG_IMAGE_URL = `${SITE_URL}og-image.png`;

  test("has SEO and social meta tags", async ({ page }) => {
    await page.goto("/");
    const nonEmpty = /\S/;

    await expect(page.locator('meta[name="description"]')).toHaveAttribute("content", nonEmpty);
    for (const property of ["og:title", "og:description", "og:url", "og:type"]) {
      await expect(page.locator(`meta[property="${property}"]`)).toHaveAttribute("content", nonEmpty);
    }
    for (const name of ["twitter:card", "twitter:title", "twitter:description"]) {
      await expect(page.locator(`meta[name="${name}"]`)).toHaveAttribute("content", nonEmpty);
    }

    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute("content", "summary_large_image");
    await expect(page.locator('meta[property="og:url"]')).toHaveAttribute("content", SITE_URL);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute("content", OG_IMAGE_URL);
    await expect(page.locator('meta[name="twitter:image"]')).toHaveAttribute("content", OG_IMAGE_URL);
    await expect(page.locator('meta[property="og:image:width"]')).toHaveAttribute("content", "1200");
    await expect(page.locator('meta[property="og:image:height"]')).toHaveAttribute("content", "630");
    await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute("content", "#111827");
  });

  test("serves the social preview image under the base path", async ({ page, baseURL }) => {
    const res = await page.request.get(new URL("og-image.png", baseURL).href);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/png");

    const rootRes = await page.request.get(new URL("/og-image.png", baseURL).href, { maxRedirects: 0 });
    expect(rootRes.ok() && (rootRes.headers()["content-type"] ?? "").includes("image/png")).toBe(false);
  });
});
