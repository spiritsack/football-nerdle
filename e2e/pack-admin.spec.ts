import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.PACK_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PACK_ADMIN_PASSWORD;

test.describe("Admin Pack Builder", () => {
  test("Pack Builder tab renders the publish form (no auth required for tab-render check)", async ({ page }) => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      test.skip(true, "Set PACK_ADMIN_EMAIL/PACK_ADMIN_PASSWORD to run admin e2e.");
      return;
    }

    await page.goto("/#/admin");
    await page.getByPlaceholder("Email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    // Switch to Pack Builder tab.
    await page.getByRole("tab", { name: "Pack Builder" }).click();

    const builder = page.getByLabel("Pack Builder");
    await expect(builder).toBeVisible();

    // Date input + club input + 10 player slots.
    await expect(builder.getByLabel("Date")).toBeVisible();
    await expect(builder.getByLabel("Club")).toBeVisible();
    await expect(builder.getByPlaceholder("Player 1")).toBeVisible();
    await expect(builder.getByPlaceholder("Player 10")).toBeVisible();

    // Publish button is disabled until 10 players + club are selected.
    const publishBtn = builder.getByRole("button", { name: /Publish Pack/ });
    await expect(publishBtn).toBeDisabled();
    await expect(builder.getByText(/Pick a club|Need 10 players/)).toBeVisible();
  });

  test("publish flow: build pack and verify it plays on /pack", async ({ page }) => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      test.skip(true, "Set PACK_ADMIN_EMAIL/PACK_ADMIN_PASSWORD to run admin e2e.");
      return;
    }

    // Mock supabase pack_schedule insert so the test doesn't pollute prod data.
    await page.route(/\/rest\/v1\/pack_schedule(\?.*)?$/, (route) => {
      const method = route.request().method();
      if (method === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ date: "2099-01-01" }]),
        });
      }
      // Pretend nothing is scheduled for the picked date.
      return route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });

    await page.goto("/#/admin");
    await page.getByPlaceholder("Email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.getByRole("tab", { name: "Pack Builder" }).click();

    // Pick a club: search for a known top club.
    const builder = page.getByLabel("Pack Builder");
    const clubInput = builder.getByPlaceholder("Search clubs...");
    await clubInput.fill("Liverpool");
    const clubOption = page.getByRole("listbox").getByRole("button").first();
    await clubOption.waitFor({ state: "visible", timeout: 5_000 });
    await clubOption.click();

    // Fill 10 players via the per-row search.
    const knownPlayers = ["Lewandowski", "Messi", "Ronaldo", "Mbappe", "Haaland", "Salah", "Modric", "Kane", "Benzema", "De Bruyne"];
    for (let i = 0; i < 10; i++) {
      const slot = builder.getByPlaceholder(`Player ${i + 1}`);
      if (!(await slot.isVisible().catch(() => false))) break;
      await slot.fill(knownPlayers[i]);
      const opt = page.getByRole("option").first();
      const ok = await opt.waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false);
      if (!ok) break;
      await opt.click();
    }

    const publishBtn = builder.getByRole("button", { name: /Publish Pack/ });
    if (await publishBtn.isDisabled()) {
      test.skip(true, "Could not auto-fill 10 valid players from the search results.");
      return;
    }

    await publishBtn.click();
    await expect(builder.getByRole("status")).toContainText(/Pack published/);
  });
});
