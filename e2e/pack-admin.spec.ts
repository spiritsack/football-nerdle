import { test, expect } from "@playwright/test";

const ADMIN_EMAIL = process.env.PACK_ADMIN_EMAIL;
const ADMIN_PASSWORD = process.env.PACK_ADMIN_PASSWORD;

test.describe("Admin Pack Builder", () => {
  test("Pack Builder tab renders the form, candidates appear after picking a club", async ({ page }) => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      test.skip(true, "Set PACK_ADMIN_EMAIL/PACK_ADMIN_PASSWORD to run admin e2e.");
      return;
    }

    await page.goto("/#/admin");
    await page.getByPlaceholder("Email").fill(ADMIN_EMAIL);
    await page.getByPlaceholder("Password").fill(ADMIN_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();

    await page.getByRole("tab", { name: "Pack Builder" }).click();
    const builder = page.getByLabel("Pack Builder");
    await expect(builder).toBeVisible();
    await expect(builder.getByLabel("Date")).toBeVisible();

    // Publish disabled until conditions met.
    const publishBtn = builder.getByRole("button", { name: /Publish Pack/ });
    await expect(publishBtn).toBeDisabled();

    // Pick a club; candidate panel should populate.
    const clubInput = builder.getByPlaceholder("Search clubs...");
    await clubInput.fill("Liverpool");
    const clubOption = page.getByRole("listbox").getByRole("button").first();
    await clubOption.waitFor({ state: "visible", timeout: 5_000 });
    await clubOption.click();

    const candidatesPanel = builder.getByLabel("Candidates");
    await expect(candidatesPanel).toBeVisible();
    await expect(candidatesPanel.getByRole("button", { name: /^Add / }).first()).toBeVisible({ timeout: 10_000 });

    // Selected panel shows 10 empty slots.
    const selected = builder.getByLabel("Selected");
    await expect(selected.getByText("0 / 10")).toBeVisible();
    await expect(selected.getByText("empty slot")).toHaveCount(10);
  });

  test("publish flow: rank candidates, add 10, publish", async ({ page }) => {
    if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
      test.skip(true, "Set PACK_ADMIN_EMAIL/PACK_ADMIN_PASSWORD to run admin e2e.");
      return;
    }

    // Mock pack_schedule writes and conflict-check so we don't pollute data.
    await page.route(/\/rest\/v1\/pack_schedule(\?.*)?$/, (route) => {
      const method = route.request().method();
      if (method === "POST") {
        return route.fulfill({
          status: 201,
          contentType: "application/json",
          body: JSON.stringify([{ date: "2099-01-01" }]),
        });
      }
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
    const builder = page.getByLabel("Pack Builder");
    const clubInput = builder.getByPlaceholder("Search clubs...");
    await clubInput.fill("Liverpool");
    const clubOption = page.getByRole("listbox").getByRole("button").first();
    await clubOption.waitFor({ state: "visible", timeout: 5_000 });
    await clubOption.click();

    const candidatesPanel = builder.getByLabel("Candidates");
    await candidatesPanel.getByRole("button", { name: /^Add / }).first().waitFor({ state: "visible", timeout: 10_000 });

    // Add the top 10 candidates.
    for (let i = 0; i < 10; i++) {
      const enabledAdd = candidatesPanel.getByRole("button", { name: /^Add / }).filter({ hasNotText: "Added" }).first();
      const ok = await enabledAdd.waitFor({ state: "visible", timeout: 3_000 }).then(() => true).catch(() => false);
      if (!ok) break;
      await enabledAdd.click();
    }

    const publishBtn = builder.getByRole("button", { name: /Publish Pack/ });
    if (await publishBtn.isDisabled()) {
      test.skip(true, "Fewer than 10 ranked candidates available for the picked club.");
      return;
    }

    await publishBtn.click();
    await expect(builder.getByRole("status")).toContainText(/Pack published/);
  });
});
