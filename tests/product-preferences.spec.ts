import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

test.describe("Product Preferences Feature", () => {
  test("T1: Settings page renders new sections (DE)", async ({ page }) => {
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Unverträglichkeiten")).toBeVisible();
    await expect(page.getByText("Produktpräferenzen")).toBeVisible();

    await expect(page.getByText("Glutenfrei")).toBeVisible();
    await expect(page.getByText("Laktosefrei")).toBeVisible();
    await expect(page.getByText("Nussfrei")).toBeVisible();

    await expect(page.getByText("Günstigste Produkte bevorzugen")).toBeVisible();
    await expect(page.getByText("Markenartikel bevorzugen")).toBeVisible();
    await expect(page.getByText("Bio-Produkte bevorzugen")).toBeVisible();
    await expect(page.getByText("Vegane Produkte bevorzugen")).toBeVisible();
    await expect(page.getByText("Tierwohlprodukte bevorzugen")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/t1-settings-de.png", fullPage: true });
  });

  test("T2: Settings page renders new sections (EN)", async ({ page }) => {
    await page.goto(`${BASE}/en/settings`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Dietary restrictions")).toBeVisible();
    await expect(page.getByText("Product preferences")).toBeVisible();
    await expect(page.getByText("Gluten-free")).toBeVisible();
    await expect(page.getByText("Lactose-free")).toBeVisible();
    await expect(page.getByText("Nut-free")).toBeVisible();
    await expect(page.getByText("Prefer cheapest products")).toBeVisible();
    await expect(page.getByText("Prefer branded products")).toBeVisible();
    await expect(page.getByText("Prefer organic products")).toBeVisible();
    await expect(page.getByText("Prefer vegan products")).toBeVisible();
    await expect(page.getByText("Prefer animal welfare products")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/t2-settings-en.png", fullPage: true });
  });

  test("T3: Toggle persistence via localStorage", async ({ page }) => {
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    const glutenToggle = page.locator("label", { hasText: "Glutenfrei" }).locator("input[type=checkbox]");
    const bioToggle = page.locator("label", { hasText: "Bio-Produkte bevorzugen" }).locator("input[type=checkbox]");

    await expect(glutenToggle).not.toBeChecked();
    await expect(bioToggle).not.toBeChecked();

    await glutenToggle.check({ force: true });
    await bioToggle.check({ force: true });

    await expect(glutenToggle).toBeChecked();
    await expect(bioToggle).toBeChecked();

    const prefs = await page.evaluate(() => localStorage.getItem("product-preferences"));
    expect(prefs).toBeTruthy();
    const parsed = JSON.parse(prefs!);
    expect(parsed.exclude_gluten).toBe(true);
    expect(parsed.prefer_bio).toBe(true);

    await page.screenshot({ path: "tests/screenshots/t3-toggles-enabled.png", fullPage: true });

    await page.goto(`${BASE}/de`);
    await page.waitForLoadState("networkidle");
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    const glutenAfter = page.locator("label", { hasText: "Glutenfrei" }).locator("input[type=checkbox]");
    const bioAfter = page.locator("label", { hasText: "Bio-Produkte bevorzugen" }).locator("input[type=checkbox]");
    await expect(glutenAfter).toBeChecked();
    await expect(bioAfter).toBeChecked();

    await page.screenshot({ path: "tests/screenshots/t3-toggles-persisted.png", fullPage: true });

    await glutenAfter.uncheck({ force: true });
    await bioAfter.uncheck({ force: true });
  });

  test("T4: Brand toggle persistence and mutual exclusion", async ({ page }) => {
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    const brandToggle = page.locator("label", { hasText: "Markenartikel bevorzugen" }).locator("input[type=checkbox]");
    const cheapestToggle = page.locator("label", { hasText: "Günstigste Produkte bevorzugen" }).locator("input[type=checkbox]");

    await expect(brandToggle).not.toBeChecked();

    await brandToggle.check({ force: true });
    await expect(brandToggle).toBeChecked();

    const prefs = await page.evaluate(() => {
      const raw = localStorage.getItem("product-preferences");
      return raw ? JSON.parse(raw) : null;
    });
    expect(prefs.prefer_brand).toBe(true);

    await expect(cheapestToggle).toBeDisabled();

    await page.screenshot({ path: "tests/screenshots/t4-brand-toggle.png", fullPage: true });

    await brandToggle.uncheck({ force: true });
  });

  test("T5: Home page loads normally", async ({ page }) => {
    await page.goto(`${BASE}/de`);
    await page.waitForLoadState("networkidle");

    await expect(page.locator("body")).not.toBeEmpty();
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.waitForTimeout(2000);
    await page.screenshot({ path: "tests/screenshots/t5-home.png", fullPage: true });

    const criticalErrors = consoleErrors.filter(
      (e) => !e.includes("favicon") && !e.includes("hydration")
    );
    expect(criticalErrors.length).toBe(0);
  });

  test("T6: Search works on home page", async ({ page }) => {
    await page.goto(`${BASE}/de`);
    await page.waitForLoadState("networkidle");

    const searchInput = page.locator("input[type=search], input[type=text]").first();
    await searchInput.fill("Milch");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "tests/screenshots/t6-search-milch.png", fullPage: true });
  });

  test("T7: Capture page loads", async ({ page }) => {
    await page.goto(`${BASE}/de/capture`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Produkte & Kassenzettel erfassen")).toBeVisible();
    await page.screenshot({ path: "tests/screenshots/t7-capture.png", fullPage: true });
  });

  test("T8: List page loads", async ({ page }) => {
    await page.goto(`${BASE}/de/list`);
    await page.waitForLoadState("networkidle");

    await page.screenshot({ path: "tests/screenshots/t8-list.png", fullPage: true });
  });

  test("T9: No JS errors on settings page", async ({ page }) => {
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    expect(jsErrors.length).toBe(0);
  });
});
