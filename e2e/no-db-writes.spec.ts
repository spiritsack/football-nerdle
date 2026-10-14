import { test, expect, mockTheSportsDB } from "./fixtures";

test.describe("E2E suite does not write to the database", () => {
  test("finishing a daily game does not write daily_results", async ({ page, blockedWrites }) => {
    await mockTheSportsDB(page);
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/#/guess");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });

    const skip = page.getByRole("button", { name: "Skip", exact: true });
    for (let i = 0; i < 5; i++) {
      await skip.click();
    }
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();

    // The result submission was intercepted by the fixture, never sent
    await expect
      .poll(() =>
        blockedWrites.some(
          (w) => w.method === "POST" && new URL(w.url).pathname.endsWith("/rest/v1/daily_results"),
        ),
      )
      .toBe(true);

    // The app treated the stubbed insert as success
    const submitted = await page.evaluate(() =>
      Object.keys(localStorage).some((k) => k.startsWith("football-nerdle-lb-")),
    );
    expect(submitted).toBe(true);
  });

  test("creating a multiplayer room does not write game_rooms", async ({ page, blockedWrites }) => {
    await page.goto("/");
    await page.evaluate(() => localStorage.clear());
    await page.goto("/#/battle/multiplayer");

    await page.getByRole("button", { name: "Create Room" }).click();

    // The app accepted the stubbed row and moved to the waiting screen
    await expect(page.getByText("Waiting for opponent to join...")).toBeVisible({ timeout: 10_000 });
    const roomCode = page.getByText("Room Code", { exact: true }).locator("xpath=following-sibling::p[1]");
    await expect(roomCode).toHaveText(/^[A-HJ-NP-Z2-9]{6}$/);

    // The room insert was intercepted by the fixture, never sent
    expect(
      blockedWrites.some((w) => w.method === "POST" && w.url.includes("/rest/v1/game_rooms")),
    ).toBe(true);
  });
});
