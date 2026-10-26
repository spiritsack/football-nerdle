import { test, expect, seedAdminSession, todayString, DATA_TIMEOUT, type Page } from "./fixtures";

/** A write the page sent; none reach Supabase */
interface Write {
  method: string;
  path: string;
  body: Record<string, unknown> | null;
}

interface Stubs {
  /** Status for the clubs insert; anything but 201 answers with an RLS-style error */
  clubsInsertStatus?: number;
  /** Fail the duplicate check (the `limit=50` clubs reads) */
  failCheck?: boolean;
  /** Status for the crest upload to storage */
  storageStatus?: number;
}

const RLS_ERROR = 'new row violates row-level security policy for table "clubs"';
const NEW_CLUB = "Zzyzx Qwerty";
// 1x1 transparent PNG
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  "base64",
);

function tomorrow(): string {
  return todayString(new Date(Date.now() + 24 * 60 * 60 * 1000));
}

/**
 * Sign in with a fake admin session, schedule Mbappé tomorrow, stub every DB
 * and storage write (recorded in the returned list), and open his club
 * history's "Add a club" form.
 */
async function openAddClubForm(page: Page, stubs: Stubs = {}): Promise<Write[]> {
  const writes: Write[] = [];
  await seedAdminSession(page);

  await page.route("**/rest/v1/daily_schedule*", (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify([{ date: tomorrow(), player_id: "tm_342229" }]),
    });
  });

  await page.route("**/rest/v1/clubs*", (route) => {
    const url = new URL(route.request().url());
    if (stubs.failCheck && route.request().method() === "GET" && url.searchParams.get("limit") === "50") {
      return route.fulfill({ status: 500, contentType: "application/json", body: JSON.stringify({ message: "boom" }) });
    }
    return route.fallback();
  });

  await page.route("**/rest/v1/**", async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (request.method() === "GET" || request.method() === "HEAD" || url.pathname.includes("/rest/v1/rpc/")) {
      return route.fallback();
    }
    const body = (request.postDataJSON() ?? null) as Record<string, unknown> | null;
    const table = url.pathname.split("/rest/v1/")[1];
    writes.push({ method: request.method(), path: table, body });

    if (table === "clubs" && request.method() === "POST") {
      const status = stubs.clubsInsertStatus ?? 201;
      if (status !== 201) {
        return route.fulfill({
          status,
          contentType: "application/json",
          body: JSON.stringify({ code: "42501", message: RLS_ERROR, details: null, hint: null }),
        });
      }
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({ id: body!.id, name: body!.name, badge: body!.badge }),
      });
    }
    if (table === "player_clubs" && request.method() === "POST") {
      const club = writes.find((w) => w.path === "clubs" && w.method === "POST")?.body;
      return route.fulfill({
        status: 201,
        contentType: "application/json",
        body: JSON.stringify({
          id: 999_999,
          is_hidden: false,
          is_youth_team: false,
          ...body,
          clubs: { name: club?.name ?? body!.club_id, badge: "" },
        }),
      });
    }
    return route.fulfill({ status: 204, body: "" });
  });

  await page.route("**/storage/v1/object/**", (route) => {
    const request = route.request();
    if (request.method() === "GET") return route.fallback();
    writes.push({ method: request.method(), path: new URL(request.url()).pathname.split("/storage/v1/object/")[1], body: null });
    const status = stubs.storageStatus ?? 200;
    return route.fulfill({
      status,
      contentType: "application/json",
      body: JSON.stringify(status === 200 ? { Key: "club-crests/x.png", Id: "x" } : { statusCode: String(status), error: "Error", message: "upload failed" }),
    });
  });

  await page.goto("/#/admin");
  await page.getByRole("button", { name: /Kylian Mbappé/ }).first().click({ timeout: DATA_TIMEOUT });
  await expect(page.getByPlaceholder("Search club...")).toBeVisible({ timeout: DATA_TIMEOUT });
  return writes;
}

/** Type a name with no existing club and open the panel from the button under the input */
async function openCreatePanel(page: Page, name = NEW_CLUB) {
  await page.getByPlaceholder("Search club...").fill(name);
  await page.getByRole("button", { name: "+ Create new club" }).click();
  const panel = page.getByRole("region", { name: "Create a club" });
  await expect(panel).toBeVisible();
  return panel;
}

/** Writes other than the ones a create-and-add flow is allowed to send */
function unexpectedWrites(writes: Write[]): Write[] {
  return writes.filter(
    (w) =>
      !(w.path === "clubs" && (w.method === "POST" || w.method === "PATCH")) &&
      !(w.path === "player_clubs" && (w.method === "POST" || w.method === "PATCH")) &&
      !w.path.startsWith("club-crests/"),
  );
}

test.describe("Admin: create a club", () => {
  test("opens the panel with the search query as the name", async ({ page }) => {
    const writes = await openAddClubForm(page);
    const panel = await openCreatePanel(page);
    await expect(panel.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(NEW_CLUB);
    await expect(panel.getByRole("textbox", { name: "Name", exact: true })).toBeFocused();
    await expect(page.getByRole("button", { name: "+ Create new club" })).toHaveCount(0);

    await panel.getByRole("button", { name: "Cancel" }).click();
    await expect(panel).toHaveCount(0);
    await expect(page.getByPlaceholder("Search club...")).toBeFocused();
    expect(writes).toEqual([]);
  });

  test("rejects an empty or too long name without creating anything", async ({ page }) => {
    const writes = await openAddClubForm(page);
    const panel = await openCreatePanel(page);

    await panel.getByRole("textbox", { name: "Name", exact: true }).fill("   ");
    await panel.getByRole("button", { name: "Check & create" }).click();
    await expect(panel.getByRole("alert")).toHaveText("Enter a club name.");

    await panel.getByRole("textbox", { name: "Name", exact: true }).fill("x".repeat(101));
    await expect(panel.getByRole("alert")).toHaveCount(0);
    await panel.getByRole("textbox", { name: "Name", exact: true }).press("Enter");
    await expect(panel.getByRole("alert")).toHaveText("Club name must be 100 characters or fewer.");
    expect(writes).toEqual([]);
  });

  test("lists existing AC Milan clubs and uses one without creating a club", async ({ page }) => {
    const writes = await openAddClubForm(page);
    const search = page.getByPlaceholder("Search club...");
    await search.fill("AC Milan");
    // With search hits, the button is the dropdown's last row
    const createButton = page.getByRole("listitem").getByRole("button", { name: "+ Create new club" });
    await expect(createButton).toBeVisible({ timeout: DATA_TIMEOUT });
    await expect(page.getByRole("button", { name: "+ Create new club" })).toHaveCount(1);
    await createButton.click();

    const panel = page.getByRole("region", { name: "Create a club" });
    await panel.getByRole("button", { name: "Check & create" }).click();
    await expect(panel.getByText(/Already in the database \(\d+\)/)).toBeVisible({ timeout: DATA_TIMEOUT });
    await expect(panel.getByRole("button", { name: "Create anyway" })).toBeVisible();

    const rows = panel.getByRole("list", { name: "Existing clubs with a similar name" }).getByRole("listitem");
    const firstRow = rows.first();
    await expect(firstRow.getByText("Same name")).toBeVisible();
    const clubName = await firstRow.locator("p").first().textContent();
    await firstRow.getByRole("button", { name: "Use this club" }).click();

    await expect(panel).toHaveCount(0);
    await expect(search).toHaveValue(clubName!);
    await expect(page.getByRole("status")).toHaveCount(0);
    expect(writes).toEqual([]);
  });

  test("editing the name clears the warning", async ({ page }) => {
    await openAddClubForm(page);
    const panel = await openCreatePanel(page, "Ajax");
    await panel.getByRole("button", { name: "Check & create" }).click();
    await expect(panel.getByRole("button", { name: "Create anyway" })).toBeVisible({ timeout: DATA_TIMEOUT });
    await panel.getByRole("textbox", { name: "Name", exact: true }).fill("Ajax Amsterdam");
    await expect(panel.getByText(/Already in the database/)).toHaveCount(0);
    await expect(panel.getByRole("button", { name: "Check & create" })).toBeVisible();
  });

  test("creates a club, selects it and adds a Present spell with it", async ({ page }) => {
    const writes = await openAddClubForm(page);
    const panel = await openCreatePanel(page);

    const country = panel.getByLabel("Country");
    await expect(country.locator("option")).not.toHaveCount(1, { timeout: DATA_TIMEOUT });
    await expect(country.locator("option", { hasText: "Loading countries…" })).toHaveCount(0, { timeout: DATA_TIMEOUT });
    await country.selectOption({ index: 1 });
    const countryId = await country.inputValue();
    expect(countryId).not.toBe("");

    await panel.getByRole("button", { name: "Check & create" }).click();
    await expect(panel).toHaveCount(0, { timeout: DATA_TIMEOUT });

    const inserts = writes.filter((w) => w.path === "clubs" && w.method === "POST");
    expect(inserts).toHaveLength(1);
    const clubId = inserts[0].body!.id as string;
    expect(clubId).toMatch(/^admin_[0-9a-f-]{36}$/);
    expect(inserts[0].body).toMatchObject({ name: NEW_CLUB, country_id: countryId, badge: "" });

    await expect(page.getByPlaceholder("Search club...")).toHaveValue(NEW_CLUB);
    await expect(page.getByRole("status")).toHaveText(`Created "${NEW_CLUB}". Add the spell below.`);

    await page.getByPlaceholder("Joined").fill("2025");
    await page.getByLabel("Present").check();
    await page.getByRole("button", { name: "Add", exact: true }).click();

    await expect(page.getByPlaceholder("Search club...")).toHaveValue("", { timeout: DATA_TIMEOUT });
    const spell = writes.find((w) => w.path === "player_clubs" && w.method === "POST");
    expect(spell?.body).toMatchObject({ player_id: "tm_342229", club_id: clubId, year_joined: "2025", year_departed: "" });
    expect(unexpectedWrites(writes)).toEqual([]);
  });

  test("a failed duplicate check shows an error and creates nothing", async ({ page }) => {
    const writes = await openAddClubForm(page, { failCheck: true });
    const panel = await openCreatePanel(page);
    await panel.getByRole("button", { name: "Check & create" }).click();
    await expect(panel.getByRole("alert")).toHaveText("Couldn't check for existing clubs. Try again.", { timeout: DATA_TIMEOUT });
    await expect(panel.getByRole("button", { name: "Check & create" })).toBeEnabled();
    expect(writes).toEqual([]);
  });

  test("a refused insert shows the error and keeps the values", async ({ page }) => {
    const writes = await openAddClubForm(page, { clubsInsertStatus: 403 });
    const panel = await openCreatePanel(page);
    await panel.getByRole("button", { name: "Check & create" }).click();
    await expect(panel.getByRole("alert")).toHaveText(RLS_ERROR, { timeout: DATA_TIMEOUT });
    await expect(panel.getByRole("textbox", { name: "Name", exact: true })).toHaveValue(NEW_CLUB);
    await expect(page.getByPlaceholder("Search club...")).toHaveValue(NEW_CLUB);
    expect(writes.filter((w) => w.path === "clubs" && w.method === "POST")).toHaveLength(1);
    expect(writes.filter((w) => w.path === "player_clubs")).toEqual([]);
  });

  test("uploads a picked crest after the insert", async ({ page }) => {
    const writes = await openAddClubForm(page);
    const panel = await openCreatePanel(page);
    await panel.locator('input[type="file"]').setInputFiles({ name: "crest.png", mimeType: "image/png", buffer: PNG });
    await expect(panel.getByAltText("Crest preview")).toBeVisible();
    expect(writes).toEqual([]);

    await panel.getByRole("button", { name: "Check & create" }).click();
    await expect(panel).toHaveCount(0, { timeout: DATA_TIMEOUT });
    const clubId = writes.find((w) => w.path === "clubs" && w.method === "POST")!.body!.id as string;
    const order = writes.map((w) => `${w.method} ${w.path.split("?")[0]}`);
    expect(order.indexOf(`POST club-crests/${clubId}.png`)).toBeGreaterThan(order.indexOf("POST clubs"));
    await expect(page.getByRole("status")).toHaveText(`Created "${NEW_CLUB}". Add the spell below.`);
    expect(unexpectedWrites(writes)).toEqual([]);
  });

  test("a failed crest upload still selects the club and says so", async ({ page }) => {
    const writes = await openAddClubForm(page, { storageStatus: 500 });
    const panel = await openCreatePanel(page);
    await panel.locator('input[type="file"]').setInputFiles({ name: "crest.png", mimeType: "image/png", buffer: PNG });
    await panel.getByRole("button", { name: "Check & create" }).click();
    await expect(page.getByRole("status")).toHaveText(
      "Club created, but the crest upload failed — drag a crest onto its badge.",
      { timeout: DATA_TIMEOUT },
    );
    await expect(page.getByPlaceholder("Search club...")).toHaveValue(NEW_CLUB);
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeDisabled();
    await page.getByPlaceholder("Joined").fill("2025");
    await expect(page.getByRole("button", { name: "Add", exact: true })).toBeEnabled();
    expect(unexpectedWrites(writes)).toEqual([]);
  });

  test("the panel fits a 375px wide screen", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await openAddClubForm(page);
    const panel = await openCreatePanel(page, "AC Milan");
    await panel.getByRole("button", { name: "Check & create" }).click();
    await expect(panel.getByRole("button", { name: "Create anyway" })).toBeVisible({ timeout: DATA_TIMEOUT });
    const box = (await panel.boundingBox())!;
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(375);
    // Nothing inside the panel scrolls sideways
    expect(await panel.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
  });
});
