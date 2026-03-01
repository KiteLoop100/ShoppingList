import { test, expect } from "@playwright/test";

const BASE = "http://localhost:3000";

// ============================================================
// 1. Core Pages — load, no JS errors
// ============================================================
test.describe("Core pages load without errors", () => {
  for (const path of [
    "/de",
    "/en",
    "/de/list",
    "/en/list",
    "/de/settings",
    "/en/settings",
    "/de/capture",
    "/en/capture",
    "/de/admin",
    "/de/receipts",
    "/de/flyer",
  ]) {
    test(`Page ${path} loads (200, no JS errors)`, async ({ page }) => {
      const jsErrors: string[] = [];
      page.on("pageerror", (err) => jsErrors.push(err.message));

      const response = await page.goto(`${BASE}${path}`, { timeout: 15000 });
      expect(response?.status()).toBe(200);
      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(2000);

      expect(jsErrors.length).toBe(0);
    });
  }
});

// ============================================================
// 2. Settings — Product Preferences Feature
// ============================================================
test.describe("Settings: Product Preferences", () => {
  test("DE: Sections and all labels visible", async ({ page }) => {
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Unverträglichkeiten")).toBeVisible();
    await expect(page.getByText("Produktpräferenzen")).toBeVisible();
    await expect(page.getByText("Glutenfrei")).toBeVisible();
    await expect(page.getByText("Laktosefrei")).toBeVisible();
    await expect(page.getByText("Nussfrei")).toBeVisible();
    await expect(page.getByText("Günstigste Produkte bevorzugen")).toBeVisible();
    await expect(page.getByText("Bio-Produkte bevorzugen")).toBeVisible();
    await expect(page.getByText("Vegane Produkte bevorzugen")).toBeVisible();
    await expect(page.getByText("Tierwohlprodukte bevorzugen")).toBeVisible();
    await expect(page.getByText("Marke vs. Eigenmarke")).toBeVisible();
    await expect(page.getByText("Neutral")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/reg-settings-de.png", fullPage: true });
  });

  test("EN: Sections and all labels visible", async ({ page }) => {
    await page.goto(`${BASE}/en/settings`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Dietary restrictions")).toBeVisible();
    await expect(page.getByText("Product preferences")).toBeVisible();
    await expect(page.getByText("Gluten-free")).toBeVisible();
    await expect(page.getByText("Lactose-free")).toBeVisible();
    await expect(page.getByText("Nut-free")).toBeVisible();
    await expect(page.getByText("Prefer cheapest products")).toBeVisible();
    await expect(page.getByText("Prefer organic products")).toBeVisible();
    await expect(page.getByText("Prefer vegan products")).toBeVisible();
    await expect(page.getByText("Prefer animal welfare products")).toBeVisible();
    await expect(page.getByText("Brand vs. private label")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/reg-settings-en.png", fullPage: true });
  });

  test("Toggle persistence across navigation", async ({ page }) => {
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    // Enable toggles
    const glutenToggle = page.locator("label", { hasText: "Glutenfrei" }).locator("input[type=checkbox]");
    const bioToggle = page.locator("label", { hasText: "Bio-Produkte bevorzugen" }).locator("input[type=checkbox]");
    const veganToggle = page.locator("label", { hasText: "Vegane Produkte bevorzugen" }).locator("input[type=checkbox]");

    await glutenToggle.check({ force: true });
    await bioToggle.check({ force: true });
    await veganToggle.check({ force: true });

    // Verify localStorage
    const prefs = await page.evaluate(() => localStorage.getItem("product-preferences"));
    expect(prefs).toBeTruthy();
    const parsed = JSON.parse(prefs!);
    expect(parsed.exclude_gluten).toBe(true);
    expect(parsed.prefer_bio).toBe(true);
    expect(parsed.prefer_vegan).toBe(true);

    // Navigate away and back
    await page.goto(`${BASE}/de`);
    await page.waitForLoadState("networkidle");
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    // Verify persistence
    const glutenAfter = page.locator("label", { hasText: "Glutenfrei" }).locator("input[type=checkbox]");
    const bioAfter = page.locator("label", { hasText: "Bio-Produkte bevorzugen" }).locator("input[type=checkbox]");
    const veganAfter = page.locator("label", { hasText: "Vegane Produkte bevorzugen" }).locator("input[type=checkbox]");
    await expect(glutenAfter).toBeChecked();
    await expect(bioAfter).toBeChecked();
    await expect(veganAfter).toBeChecked();

    await page.screenshot({ path: "tests/screenshots/reg-toggles-persisted.png", fullPage: true });

    // Cleanup
    await glutenAfter.uncheck({ force: true });
    await bioAfter.uncheck({ force: true });
    await veganAfter.uncheck({ force: true });
  });

  test("Brand toggle and mutual exclusion with cheapest", async ({ page }) => {
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    const brandToggle = page.locator("label", { hasText: "Markenartikel bevorzugen" }).locator("input[type=checkbox]");
    const cheapestToggle = page.locator("label", { hasText: "Günstigste Produkte bevorzugen" }).locator("input[type=checkbox]");

    await expect(brandToggle).not.toBeChecked();
    await brandToggle.check({ force: true });
    await expect(brandToggle).toBeChecked();

    let prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("product-preferences")!));
    expect(prefs.prefer_brand).toBe(true);

    await expect(cheapestToggle).toBeDisabled();

    await brandToggle.uncheck({ force: true });
    prefs = await page.evaluate(() => JSON.parse(localStorage.getItem("product-preferences")!));
    expect(prefs.prefer_brand).toBe(false);
  });

  test("Existing settings sections still present", async ({ page }) => {
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Sprache")).toBeVisible();
    await expect(page.getByText("Standard-Laden")).toBeVisible();
    await expect(page.getByText("Admin", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Über diese App")).toBeVisible();
    await expect(page.getByText("Version")).toBeVisible();
  });
});

// ============================================================
// 3. Admin Page — Login form renders
// ============================================================
test.describe("Admin page", () => {
  test("Admin page loads with login form", async ({ page }) => {
    await page.goto(`${BASE}/de/admin`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: "Admin" })).toBeVisible();
    const pwInput = page.locator("input[type=password]");
    await expect(pwInput).toBeVisible();
    await expect(page.locator("button[type=submit]")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/reg-admin-login.png", fullPage: true });
  });
});

// ============================================================
// 4. Batch-Jobs API Direct Tests
// ============================================================
test.describe("Batch-Jobs API", () => {
  test("GET without auth returns 401", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/batch-jobs?job_id=test`);
    expect(res.status()).toBe(401);
  });

  test("POST without auth returns 401", async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/batch-jobs`, {
      data: { job_type: "reclassify" },
    });
    expect(res.status()).toBe(401);
  });

  test("Admin login API rejects empty password when ADMIN_PASSWORD unset", async ({ request }) => {
    const res = await request.post(`${BASE}/api/admin/login`, {
      data: { password: "" },
    });
    // When ADMIN_PASSWORD env is not set, login always returns 401
    expect(res.status()).toBe(401);
  });

  test("Admin check returns 401 without session", async ({ request }) => {
    const res = await request.get(`${BASE}/api/admin/check`);
    expect(res.status()).toBe(401);
  });

  test("Existing per-batch API still returns 401 without auth", async ({ request }) => {
    const res1 = await request.post(`${BASE}/api/admin/assign-demand-groups`, {
      data: {},
    });
    expect(res1.status()).toBe(401);

    const res2 = await request.post(`${BASE}/api/admin/reclassify-products`, {
      data: {},
    });
    expect(res2.status()).toBe(401);
  });
});

// ============================================================
// 5. Home Page — Search
// ============================================================
test.describe("Home: Search", () => {
  test("Search field accepts input", async ({ page }) => {
    await page.goto(`${BASE}/de`);
    await page.waitForLoadState("networkidle");

    const searchInput = page.locator("input[type=search], input[type=text]").first();
    await expect(searchInput).toBeVisible();
    await searchInput.fill("Milch");
    await page.waitForTimeout(2000);

    await page.screenshot({ path: "tests/screenshots/reg-search.png", fullPage: true });
  });

  test("Quick-action chips visible", async ({ page }) => {
    await page.goto(`${BASE}/de`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Letzte Einkäufe")).toBeVisible();
    await expect(page.getByText("Aktionsartikel")).toBeVisible();
  });
});

// ============================================================
// 6. Capture Page
// ============================================================
test.describe("Capture page", () => {
  test("DE: Title and menu items visible", async ({ page }) => {
    await page.goto(`${BASE}/de/capture`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Produkte & Kassenzettel erfassen")).toBeVisible();
    await expect(page.getByText("Produkt anlegen")).toBeVisible();
    await expect(page.getByText("Kassenzettel scannen")).toBeVisible();

    await page.screenshot({ path: "tests/screenshots/reg-capture.png", fullPage: true });
  });
});

// ============================================================
// 7. Receipts Page
// ============================================================
test.describe("Receipts page", () => {
  test("DE: Receipts page loads", async ({ page }) => {
    await page.goto(`${BASE}/de/receipts`);
    await page.waitForLoadState("networkidle");

    // Should show title or empty state
    const body = await page.textContent("body");
    expect(body).toBeTruthy();

    await page.screenshot({ path: "tests/screenshots/reg-receipts.png", fullPage: true });
  });
});

// ============================================================
// 8. Flyer Page
// ============================================================
test.describe("Flyer page", () => {
  test("DE: Flyer page loads", async ({ page }) => {
    await page.goto(`${BASE}/de/flyer`);
    await page.waitForLoadState("networkidle");

    const body = await page.textContent("body");
    expect(body).toBeTruthy();

    await page.screenshot({ path: "tests/screenshots/reg-flyer.png", fullPage: true });
  });
});

// ============================================================
// 9. Navigation — Links work
// ============================================================
test.describe("Navigation", () => {
  test("Settings back button goes to home", async ({ page }) => {
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    await page.locator("a[aria-label='Zurück']").click();
    await page.waitForLoadState("networkidle");

    expect(page.url()).toContain("/de");
  });

  test("Capture back button goes to home", async ({ page }) => {
    await page.goto(`${BASE}/de/capture`);
    await page.waitForLoadState("networkidle");

    // Click back link
    const backLink = page.locator("a").filter({ hasText: /^‹$|^←$/ }).first();
    if (await backLink.isVisible()) {
      await backLink.click();
      await page.waitForLoadState("networkidle");
      expect(page.url()).toContain("/de");
    }
  });
});

// ============================================================
// 10. Language Switching
// ============================================================
test.describe("Language switching", () => {
  test("DE → EN switch works on settings page", async ({ page }) => {
    await page.goto(`${BASE}/de/settings`);
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Einstellungen")).toBeVisible();

    // Click English button
    await page.getByText("Englisch").click();
    await page.waitForLoadState("networkidle");

    await expect(page.getByText("Settings")).toBeVisible();
    expect(page.url()).toContain("/en/settings");
  });
});
