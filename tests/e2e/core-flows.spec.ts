import { test, expect } from "./fixtures";
import {
  openApp,
  skipOnboarding,
  waitForListReady,
  addFirstSearchResult,
  addFreeTextItem,
  rowByName,
  uncheckedRows,
  swipeRowLeft,
  uniqueName,
} from "./helpers/app";

/**
 * Core shopping-list flows. All tests share the run's anonymous session
 * (global-setup → storageState) in a fresh browser context each; the fixture
 * wipes the user's list data before every test so each one starts empty.
 *
 * No AI features are exercised: the only AI route on these paths
 * (/api/assign-category for free-text items) is stubbed in the browser.
 */
/** Supabase responses the app handles with a documented fallback (see test a). */
const KNOWN_STARTUP_RESPONSES = [
  /^404 POST .*\/rest\/v1\/rpc\/get_user_purchase_history$/,
  /^409 POST .*\/rest\/v1\/shopping_lists\b/,
];

test.describe("Core shopping list flows", () => {
  test("a) app opens with an empty list and no console errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    const failedRequests: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    page.on("response", (res) => {
      if (res.status() >= 400) failedRequests.push(`${res.status()} ${res.request().method()} ${res.url()}`);
    });

    await openApp(page);

    await expect(page.getByTestId("list-empty")).toBeVisible();
    await expect(page.getByTestId("search-input")).toBeVisible();
    // Give background work (session restore, product sync, GPS probe) a moment to surface errors.
    await page.waitForTimeout(2_000);

    expect(pageErrors, `uncaught page errors:\n${pageErrors.join("\n")}`).toEqual([]);
    // Chromium logs every 4xx response as "Failed to load resource". Two of those are
    // handled by the app on purpose and tolerated here:
    //  - 404 rpc/get_user_purchase_history: RPC is not deployed; purchase-history.ts falls back to a query
    //  - 409 shopping_lists: two providers race to create the active list; active-list.ts retries on 23505
    const unexpectedRequests = failedRequests.filter((r) => !KNOWN_STARTUP_RESPONSES.some((re) => re.test(r)));
    expect(unexpectedRequests, `unexpected failed requests:\n${unexpectedRequests.join("\n")}`).toEqual([]);
    const appErrors = consoleErrors.filter((e) => !e.startsWith("Failed to load resource"));
    expect(appErrors, `console errors:\n${appErrors.join("\n")}`).toEqual([]);
  });

  test("b) searches a catalog product and adds it to the list", async ({ page }) => {
    await openApp(page);

    const name = await addFirstSearchResult(page);

    await expect(uncheckedRows(page)).toHaveCount(1);
    const row = rowByName(page, name);
    await expect(row).toHaveAttribute("data-checked", "false");
    await expect(row.getByTestId("list-item-check")).toHaveAttribute("aria-checked", "false");
    await expect(page.getByTestId("list-empty")).toBeHidden();
  });

  test("c) adds a free-text item that is not in the catalog", async ({ page }) => {
    await openApp(page);
    const name = uniqueName("E2E Freitext");

    await addFreeTextItem(page, name);

    await expect(uncheckedRows(page)).toHaveCount(1);
    const row = rowByName(page, name);
    await expect(row).toBeVisible();
    // Free-text items are rendered italic (no product_id).
    await expect(row.getByTestId("list-item-name")).toHaveClass(/italic/);
  });

  test("d) checking off an item moves it into the collapsed 'Abgehakt' section", async ({ page }) => {
    await openApp(page);
    const keep = uniqueName("E2E Bleibt");
    const done = uniqueName("E2E Fertig");
    await addFreeTextItem(page, keep);
    await addFreeTextItem(page, done);
    await expect(uncheckedRows(page)).toHaveCount(2);

    await rowByName(page, done).getByTestId("list-item-check").click();

    // Leaves the open section after the check animation…
    await expect(uncheckedRows(page)).toHaveCount(1);
    await expect(uncheckedRows(page).getByTestId("list-item-name")).toContainText(keep);
    // …and shows up in the collapsed "Abgehakt" section.
    const toggle = page.getByTestId("checked-section-toggle");
    await expect(toggle).toContainText("Abgehakt (1)");
    await toggle.click();
    const checkedRow = page.getByTestId("checked-section").getByTestId("list-item");
    await expect(checkedRow).toHaveCount(1);
    await expect(checkedRow).toHaveAttribute("data-checked", "true");
    await expect(checkedRow.getByTestId("list-item-name")).toContainText(done);
    // One open item remains, so the trip must NOT be auto-completed.
    await expect(page.getByTestId("trip-complete")).toBeHidden();
  });

  test("e) list state survives a reload", async ({ page }) => {
    await openApp(page);
    const open = uniqueName("E2E Offen");
    const done = uniqueName("E2E Erledigt");
    await addFreeTextItem(page, open);
    await addFreeTextItem(page, done);
    await rowByName(page, done).getByTestId("list-item-check").click();
    await expect(uncheckedRows(page)).toHaveCount(1);
    await expect(page.getByTestId("checked-section-toggle")).toContainText("Abgehakt (1)");

    await page.reload();
    await waitForListReady(page);

    await expect(uncheckedRows(page)).toHaveCount(1);
    await expect(uncheckedRows(page).getByTestId("list-item-name")).toContainText(open);
    await expect(page.getByTestId("checked-section-toggle")).toContainText("Abgehakt (1)");
  });

  test("f) deletes an item via swipe", async ({ page }) => {
    await openApp(page);
    const keep = uniqueName("E2E Bleibt");
    const remove = uniqueName("E2E Weg");
    await addFreeTextItem(page, keep);
    await addFreeTextItem(page, remove);
    await expect(uncheckedRows(page)).toHaveCount(2);

    const row = rowByName(page, remove);
    await swipeRowLeft(page, row);
    await row.getByTestId("list-item-delete").click();

    await expect(rowByName(page, remove)).toHaveCount(0);
    await expect(uncheckedRows(page)).toHaveCount(1);
    await expect(uncheckedRows(page).getByTestId("list-item-name")).toContainText(keep);
    await expect(page.getByTestId("trip-complete")).toBeHidden();
  });

  /**
   * Two devices = two browser contexts sharing one account. There is no share
   * link for anonymous users; the app syncs lists per account through Supabase
   * (`list_items` Realtime subscription in use-list-data.ts). The second
   * context reuses the stored session (same cookies, no extra sign-in), which
   * is exactly what a second device gets after signing in to the same account.
   */
  test("g) a change on one device appears on a second device with the same account", async ({ page, browser, contextOptions }) => {
    await openApp(page);
    const first = uniqueName("E2E Gerät A");
    await addFreeTextItem(page, first);

    const deviceB = await browser.newContext(contextOptions);
    try {
      const pageB = await deviceB.newPage();
      await skipOnboarding(pageB);
      await pageB.goto("/de");
      await waitForListReady(pageB);
      await expect(rowByName(pageB, first)).toBeVisible();

      const second = uniqueName("E2E Gerät A2");
      await addFreeTextItem(page, second);

      await expect(rowByName(pageB, second)).toBeVisible({ timeout: 20_000 });
      await expect(uncheckedRows(pageB)).toHaveCount(2);
    } finally {
      await deviceB.close();
    }
  });
});
