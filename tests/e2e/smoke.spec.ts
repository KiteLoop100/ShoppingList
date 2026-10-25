import { test, expect } from "@playwright/test";
import { skipOnboarding } from "./helpers/app";

/**
 * Smoke tests ported from the former tests/full-regression.spec.ts.
 * Only deterministic checks survived: page loads, static labels, admin gate,
 * navigation and language switching. Settings persistence assertions were
 * dropped because preferences no longer live in the `product-preferences`
 * localStorage key (they sync through user_settings now).
 *
 * These tests create no list data, so they use the run's shared session
 * directly (storageState from global-setup) without the per-test list reset.
 */

test.describe("Core pages load without JS errors", () => {
  for (const path of [
    "/de",
    "/en",
    "/de/list",
    "/de/settings",
    "/en/settings",
    "/de/capture",
    "/de/admin",
    "/de/receipts",
    "/de/flyer",
  ]) {
    test(`Page ${path} loads (200, no JS errors)`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));
      await skipOnboarding(page);

      const response = await page.goto(path);
      expect(response?.status()).toBe(200);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(1_500);

      expect(jsErrors, jsErrors.join("\n")).toEqual([]);
    });
  }
});

test.describe("Settings page", () => {
  test("DE: sections and preference labels visible", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/de/settings");

    for (const label of [
      "Sprache",
      "Standard-Laden",
      "Unverträglichkeiten",
      "Produktpräferenzen",
      "Glutenfrei",
      "Laktosefrei",
      "Nussfrei",
      "Günstigste Produkte bevorzugen",
      "Markenartikel bevorzugen",
      "Bio-Produkte bevorzugen",
      "Vegane Produkte bevorzugen",
      "Tierwohlprodukte bevorzugen",
      "Über diese App",
    ]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("EN: sections and preference labels visible", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/en/settings");

    for (const label of [
      "Dietary restrictions",
      "Product preferences",
      "Gluten-free",
      "Lactose-free",
      "Nut-free",
      "Prefer cheapest products",
      "Prefer branded products",
      "Prefer organic products",
      "Prefer vegan products",
      "Prefer animal welfare products",
    ]) {
      await expect(page.getByText(label, { exact: true }).first()).toBeVisible();
    }
  });

  test("brand preference disables the 'cheapest' toggle", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/de/settings");

    const brandToggle = page.locator("label", { hasText: "Markenartikel bevorzugen" }).locator("input[type=checkbox]");
    const cheapestToggle = page.locator("label", { hasText: "Günstigste Produkte bevorzugen" }).locator("input[type=checkbox]");

    await expect(brandToggle).not.toBeChecked();
    await expect(cheapestToggle).toBeEnabled();

    await brandToggle.check({ force: true });
    await expect(brandToggle).toBeChecked();
    await expect(cheapestToggle).toBeDisabled();

    await brandToggle.uncheck({ force: true });
    await expect(cheapestToggle).toBeEnabled();
  });

  test("back button returns to home", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/de/settings");

    await page.getByRole("link", { name: "Zurück" }).click();

    await expect(page).toHaveURL(/\/de\/?$/);
  });

  test("DE → EN language switch", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/de/settings");
    await expect(page.getByRole("heading", { name: "Einstellungen" })).toBeVisible();

    await page.getByText("Englisch", { exact: true }).click();

    await expect(page).toHaveURL(/\/en\/settings/);
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  });
});

test.describe("Capture page", () => {
  test("DE: title and menu entries visible", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/de/capture");

    await expect(page.getByText("Produkte & Kassenzettel erfassen")).toBeVisible();
    await expect(page.getByText("Produkt anlegen").first()).toBeVisible();
    await expect(page.getByText("Kassenzettel scannen").first()).toBeVisible();
  });
});

test.describe("Admin", () => {
  test("admin page shows the login form", async ({ page }) => {
    await skipOnboarding(page);
    await page.goto("/de/admin");

    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    await expect(page.locator("input[type=password]")).toBeVisible();
    await expect(page.locator("button[type=submit]")).toBeVisible();
  });

  test("login API rejects an empty password", async ({ request }) => {
    const res = await request.post("/api/admin/login", { data: { password: "" } });
    expect([400, 401]).toContain(res.status());
  });

  test("check API returns 401 without a session", async ({ request }) => {
    const res = await request.get("/api/admin/check");
    expect(res.status()).toBe(401);
  });
});
