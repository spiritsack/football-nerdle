import { test, expect, loadPuzzle, searchFor, DATA_TIMEOUT, type Page } from "./fixtures";

// The ?id= debug load: a fixed player, outside Daily and Archive
const DEBUG_URL = "/#/guess?id=tm_342229";
const MOBILE = { width: 375, height: 667 };

const combobox = (page: Page) => page.getByRole("combobox");
const skipButton = (page: Page) => page.getByRole("button", { name: "Skip", exact: true });

async function openMobile(page: Page) {
  await page.setViewportSize(MOBILE);
  await loadPuzzle(page, () => page.goto(DEBUG_URL));
}

test.describe("Guess the Player sticky guess bar", () => {
  test("guess input is in view without scrolling on mobile", async ({ page }) => {
    await openMobile(page);
    expect(await page.evaluate(() => window.scrollY)).toBe(0);
    await expect(combobox(page)).toBeInViewport();
    await expect(skipButton(page)).toBeInViewport();
  });

  test("stays pinned while scrolling", async ({ page }) => {
    await openMobile(page);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expect(page.getByText("Club History")).toBeInViewport();
    await expect(combobox(page)).toBeInViewport();

    const bar = await page.getByTestId("guess-bar").boundingBox();
    expect(bar).not.toBeNull();
    // Pinned to the viewport bottom, or above it when the whole card fits
    expect(bar!.y + bar!.height).toBeLessThanOrEqual(MOBILE.height + 1);

    const cardFits = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
    if (!cardFits) expect(bar!.y + bar!.height).toBeGreaterThanOrEqual(MOBILE.height - 1);
  });

  test("results open above the pinned input", async ({ page }) => {
    await openMobile(page);
    const input = combobox(page);
    const listbox = page.getByRole("listbox");
    await searchFor(input, "Messi", listbox.getByText("Lionel Messi"));

    const inputBox = await input.boundingBox();
    const listBox = await listbox.boundingBox();
    expect(inputBox).not.toBeNull();
    expect(listBox).not.toBeNull();
    expect(listBox!.y + listBox!.height).toBeLessThanOrEqual(inputBox!.y);
    await expect(listbox).toBeInViewport({ ratio: 1 });
  });

  test("result screen has no guess bar", async ({ page }) => {
    await openMobile(page);
    const skip = skipButton(page);
    for (let i = 1; i < 5; i++) {
      await skip.click();
      await expect(page.getByText(new RegExp(`Attempts:.*${i}.*/.*5`))).toBeVisible();
      await expect(page.getByTestId("guess-bar")).toBeInViewport();
    }
    await skip.click();
    await expect(page.getByRole("heading", { name: "Game Over!" })).toBeVisible({ timeout: DATA_TIMEOUT });
    await expect(page.getByRole("combobox")).toHaveCount(0);
    await expect(page.getByTestId("guess-bar")).toHaveCount(0);
  });
});
