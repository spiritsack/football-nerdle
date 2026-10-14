import { test, expect, type Page } from "@playwright/test";
import { mockTheSportsDB } from "./fixtures";

const SHARE_URL_RE = /https:\/\/spiritsack\.github\.io\/football-nerdle\/#\/guess$/;

// Seed a lost daily for today and land on the "Game Over!" result screen.
async function openCompletedDaily(page: Page) {
  await mockTheSportsDB(page);
  await page.goto("/");
  await page.evaluate(() => {
    const d = new Date();
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    localStorage.setItem(
      `football-nerdle-daily-${today}`,
      JSON.stringify({ date: today, status: "lost", attempts: 5 }),
    );
  });
  await page.goto("/#/guess");
  await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible({ timeout: 15_000 });
}

// Make sure no Web Share API is exposed, whatever the browser build supports.
const REMOVE_SHARE_API = () => {
  delete (Navigator.prototype as { share?: unknown }).share;
  delete (Navigator.prototype as { canShare?: unknown }).canShare;
};

test.describe("Guess the Player share result", () => {
  test("copies to clipboard when share sheet unavailable", async ({ page, context }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await page.addInitScript(REMOVE_SHARE_API);
    await openCompletedDaily(page);

    const shareButton = page.getByRole("button", { name: "Share Result" });
    await shareButton.click();

    await expect(page.getByRole("button", { name: "Copied!" })).toBeVisible();
    const clipboard = await page.evaluate(() => navigator.clipboard.readText());
    expect(clipboard).toMatch(/^Football Nerdle .+\n.+\nhttps:\/\/spiritsack\.github\.io\/football-nerdle\/#\/guess/);
    await expect(page.getByRole("alert")).toHaveCount(0);

    // Label resets so the player can share again
    await expect(page.getByRole("button", { name: "Share Result" })).toBeVisible({ timeout: 5_000 });
  });

  test("uses native share sheet when available", async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __shareCalls: unknown[] };
      w.__shareCalls = [];
      Object.defineProperty(Navigator.prototype, "share", {
        configurable: true,
        value: (data: unknown) => {
          w.__shareCalls.push(data);
          return Promise.resolve();
        },
      });
      Object.defineProperty(Navigator.prototype, "canShare", {
        configurable: true,
        value: () => true,
      });
    });
    await openCompletedDaily(page);

    await page.getByRole("button", { name: "Share Result" }).click();

    await expect
      .poll(() => page.evaluate(() => (window as unknown as { __shareCalls: unknown[] }).__shareCalls.length))
      .toBe(1);
    const calls = await page.evaluate(() => (window as unknown as { __shareCalls: { text: string }[] }).__shareCalls);
    expect(Object.keys(calls[0])).toEqual(["text"]);
    expect(calls[0].text.startsWith("Football Nerdle ")).toBe(true);
    expect(calls[0].text).toMatch(SHARE_URL_RE);

    // The OS sheet is the feedback: the button never flips to "Copied!"
    await page.waitForTimeout(500);
    await expect(page.getByRole("button", { name: "Copied!" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Share Result" })).toBeVisible();
    await expect(page.getByRole("alert")).toHaveCount(0);
  });

  test("shows an error when sharing and copying both fail", async ({ page }) => {
    await page.addInitScript(REMOVE_SHARE_API);
    await page.addInitScript(() => {
      Clipboard.prototype.writeText = () =>
        Promise.reject(new DOMException("Write permission denied.", "NotAllowedError"));
    });
    await openCompletedDaily(page);

    const shareButton = page.getByRole("button", { name: "Share Result" });
    await shareButton.click();

    const alert = page.getByRole("alert");
    await expect(alert).toContainText("Couldn't share or copy your result. Try again or copy it manually.");
    // The share text is shown so it can be copied by hand
    await expect(alert).toContainText("Football Nerdle ");
    await expect(shareButton).toBeEnabled();
    await expect(shareButton).toHaveText("Share Result");

    // Retrying is possible and still reports the failure
    await shareButton.click();
    await expect(alert).toBeVisible();
  });
});
