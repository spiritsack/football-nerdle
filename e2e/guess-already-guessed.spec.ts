import { test, expect, loadPuzzle, mockDailySchedule, searchFor, todayString, type Page } from "./fixtures";

const search = (page: Page) => page.getByRole("combobox");
const option = (page: Page, name: RegExp) => page.getByRole("option", { name });
const attempts = (page: Page, n: number) => page.getByText(new RegExp(`Attempts:.*${n}.*/.*5`));

async function guess(page: Page, query: string, name: RegExp) {
  await searchFor(search(page), query, option(page, name));
  await option(page, name).getByRole("button").click();
}

test.describe("Guess the Player already guessed players", () => {
  test.beforeEach(async ({ page }) => {
    // Mbappé
    await loadPuzzle(page, () => page.goto("/#/guess?id=tm_342229"));
  });

  test("marks a wrong guess as already guessed", async ({ page }) => {
    await guess(page, "Lionel Messi", /Lionel Messi/);
    await expect(attempts(page, 1)).toBeVisible();

    const row = option(page, /Lionel Messi/);
    await searchFor(search(page), "Lionel Messi", row);
    await expect(row).toContainText("Already guessed");
    await expect(row).toHaveAttribute("aria-disabled", "true");
    await expect(row.getByRole("button")).toBeDisabled();
  });

  test("cannot re-submit an already guessed player", async ({ page }) => {
    // Nothing is marked before the first wrong guess
    await searchFor(search(page), "Lionel Messi", option(page, /Lionel Messi/));
    await expect(page.getByRole("listbox")).not.toContainText("Already guessed");
    await option(page, /Lionel Messi/).getByRole("button").click();
    await expect(attempts(page, 1)).toBeVisible();
    await expect(page.getByText("Wrong: Lionel Messi")).toBeVisible();

    // Clicking the disabled row does nothing and keeps the dropdown open
    const row = option(page, /Lionel Messi/);
    await searchFor(search(page), "Lionel Messi", row);
    await expect(row).toContainText("Already guessed");
    await row.getByRole("button").click({ force: true });
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(attempts(page, 1)).toBeVisible();
    await expect(page.getByText("Wrong: Lionel Messi")).toBeVisible();

    // Highlighting it and pressing Enter does nothing either
    await search(page).press("ArrowDown");
    await expect(row).toHaveAttribute("aria-selected", "true");
    await search(page).press("Enter");
    await expect(page.getByRole("listbox")).toBeVisible();
    await expect(attempts(page, 1)).toBeVisible();
    await expect(page.getByText("Wrong: Lionel Messi")).toBeVisible();

    // A different player can still be guessed
    await guess(page, "Erling Haaland", /Erling Haaland/);
    await expect(attempts(page, 2)).toBeVisible();
    await expect(page.getByText("Wrong: Lionel Messi, Erling Haaland")).toBeVisible();
  });
});

test.describe("Guess the Player already guessed players across puzzles", () => {
  test.beforeEach(async ({ page }) => {
    // Today is Mbappé, yesterday a different player, so loading it fetches a new player row
    await mockDailySchedule(page, { date: todayString(), playerId: "tm_342229" });
    await mockDailySchedule(page, { date: todayString(new Date(Date.now() - 86_400_000)), playerId: "tm_349066" });
    await loadPuzzle(page, () => page.goto("/#/guess"));
  });

  test("a new puzzle clears already guessed", async ({ page }) => {
    await guess(page, "Lionel Messi", /Lionel Messi/);
    await expect(attempts(page, 1)).toBeVisible();

    const skip = page.getByRole("button", { name: "Skip", exact: true });
    for (let i = 2; i <= 4; i++) {
      await skip.click();
      await expect(attempts(page, i)).toBeVisible();
    }
    await skip.click();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible();
    await loadPuzzle(page, () => page.getByRole("button", { name: "‹ Previous day" }).click(), attempts(page, 0));

    const row = option(page, /Lionel Messi/);
    await searchFor(search(page), "Lionel Messi", row);
    await expect(row).not.toContainText("Already guessed");
    await expect(row).toHaveAttribute("aria-disabled", "false");
    await expect(row.getByRole("button")).toBeEnabled();
  });
});
