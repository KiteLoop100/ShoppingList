import { expect, type Locator, type Page } from "@playwright/test";

export const ONBOARDING_COMPLETE_KEY = "onboarding-complete";

/** Catalog query that reliably yields results in the DE catalog. */
export const SEARCH_QUERY = "Milch";

/** Demand group returned by the stubbed /api/assign-category route (never calls Claude). */
const STUB_DEMAND_GROUP = { demand_group_code: "AK", demand_group_name: "Aktionsartikel", demand_sub_group: null, action: "matched" };

/**
 * Marks onboarding as done before any script runs, so the onboarding overlay
 * does not cover the list for a fresh anonymous session.
 */
export async function skipOnboarding(page: Page): Promise<void> {
  await page.addInitScript(
    ([key]) => localStorage.setItem(key, "true"),
    [ONBOARDING_COMPLETE_KEY] as const,
  );
}

/**
 * Opens the German home screen and waits until the list has finished its initial load.
 * Fails fast with a readable message when Supabase refuses the anonymous sign-in
 * (per-IP hourly rate limit) — otherwise every later assertion times out cryptically.
 */
export async function openApp(page: Page): Promise<void> {
  await skipOnboarding(page);
  const authFailure = new Promise<never>((_, reject) => {
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("Anonymous sign-in failed")) {
        reject(
          new Error(
            `${msg.text()} — Supabase limits anonymous sign-ins per IP and hour. ` +
              "Wait a while or raise 'Rate limit for anonymous users' in the Supabase Auth settings.",
          ),
        );
      }
    });
  });
  authFailure.catch(() => undefined); // never unhandled once the race below has settled
  await page.goto("/de");
  await Promise.race([waitForListReady(page), authFailure]);
}

/** The list is ready when either the empty hint or at least one row is rendered. */
export async function waitForListReady(page: Page): Promise<void> {
  await expect(
    page.getByTestId("list-empty").or(page.getByTestId("list-item").first()),
  ).toBeVisible({ timeout: 60_000 });
}

export function searchInput(page: Page): Locator {
  return page.getByTestId("search-input");
}

/** Rows in the open (unchecked) section only. */
export function uncheckedRows(page: Page): Locator {
  return page.getByTestId("unchecked-list").getByTestId("list-item");
}

export function rowByName(page: Page, name: string): Locator {
  return page
    .getByTestId("list-item")
    .filter({ has: page.getByTestId("list-item-name").filter({ hasText: name }) });
}

/**
 * Types a query, waits for the catalog results (first load indexes ~7k products)
 * and taps the first result. Returns the product name that was added.
 */
export async function addFirstSearchResult(page: Page, query: string = SEARCH_QUERY): Promise<string> {
  await searchInput(page).fill(query);
  const first = page.getByTestId("search-result").first();
  await expect(first).toBeVisible({ timeout: 30_000 });
  const name = (await first.locator("span.truncate").innerText()).replace(/^★\s*/, "").trim();
  await first.click();
  await expect(rowByName(page, name)).toBeVisible();
  await expect(searchInput(page)).toHaveValue("");
  return name;
}

/**
 * Adds a free-text item. The category-assignment API is an AI route; it is
 * stubbed per page so the e2e suite never spends AI budget.
 */
export async function addFreeTextItem(page: Page, name: string): Promise<void> {
  await page.route("**/api/assign-category", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(STUB_DEMAND_GROUP) }),
  );
  const input = searchInput(page);
  await input.fill(name);
  // Wait for the results overlay so the Enter key is handled by the search input, not swallowed mid-render.
  await expect(page.getByTestId("search-add-generic")).toBeVisible();
  await input.press("Enter");
  await expect(rowByName(page, name)).toBeVisible();
  await expect(input).toHaveValue("");
}

/**
 * Swipes a row to the left with real touch events (CDP), which reveals the
 * delete button the same way a user would on a phone.
 */
export async function swipeRowLeft(page: Page, row: Locator): Promise<void> {
  const box = await row.boundingBox();
  if (!box) throw new Error("row is not visible");
  const cdp = await page.context().newCDPSession(page);
  const y = box.y + box.height / 2;
  const xStart = box.x + box.width - 24;
  try {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ x: xStart, y }] });
    for (let step = 1; step <= 10; step++) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ x: xStart - step * 12, y }] });
    }
    await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  } finally {
    await cdp.detach();
  }
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}
