import { test, expect, type Page } from "@playwright/test";
import { mockTheSportsDB } from "./fixtures";

const search = (page: Page) => page.getByRole("combobox");
const option = (page: Page, name: RegExp) => page.getByRole("option", { name });
const attempts = (page: Page, n: number) => page.getByText(new RegExp(`Attempts:.*${n}.*/.*5`));

async function guess(page: Page, query: string, name: RegExp) {
  await search(page).fill(query);
  await option(page, name).getByRole("button").click();
}

test.describe("Guess the Player already guessed players", () => {
  test.beforeEach(async ({ page }) => {
    await mockTheSportsDB(page);
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.removeItem("football-nerdle-guess-stats");
    });
    // Mbappé
    await page.goto("/#/guess?id=tm_342229");
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
  });

  test("marks a wrong guess as already guessed", async ({ page }) => {
    await guess(page, "Lionel Messi", /Lionel Messi/);
    await expect(attempts(page, 1)).toBeVisible();

    await search(page).fill("Lionel Messi");
    const row = option(page, /Lionel Messi/);
    await expect(row).toContainText("Already guessed");
    await expect(row).toHaveAttribute("aria-disabled", "true");
    await expect(row.getByRole("button")).toBeDisabled();
  });

  test("cannot re-submit an already guessed player", async ({ page }) => {
    // Nothing is marked before the first wrong guess
    await search(page).fill("Lionel Messi");
    await expect(option(page, /Lionel Messi/)).toBeVisible();
    await expect(page.getByRole("listbox")).not.toContainText("Already guessed");
    await option(page, /Lionel Messi/).getByRole("button").click();
    await expect(attempts(page, 1)).toBeVisible();
    await expect(page.getByText("Wrong: Lionel Messi")).toBeVisible();

    // Clicking the disabled row does nothing and keeps the dropdown open
    await search(page).fill("Lionel Messi");
    const row = option(page, /Lionel Messi/);
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

  test("new random puzzle clears already guessed", async ({ page }) => {
    await guess(page, "Lionel Messi", /Lionel Messi/);
    await expect(attempts(page, 1)).toBeVisible();

    const skip = page.getByRole("button", { name: "Skip", exact: true });
    for (let i = 0; i < 4; i++) {
      await skip.click();
    }
    await page.getByRole("button", { name: "Random Game" }).click();
    await expect(page.getByText("Club History")).toBeVisible({ timeout: 10_000 });
    await expect(attempts(page, 0)).toBeVisible();

    await search(page).fill("Lionel Messi");
    const row = option(page, /Lionel Messi/);
    await expect(row).toBeVisible();
    await expect(row).not.toContainText("Already guessed");
    await expect(row).toHaveAttribute("aria-disabled", "false");
    await expect(row.getByRole("button")).toBeEnabled();
  });
});
