import fs from "node:fs";
import { chromium, type FullConfig } from "@playwright/test";
import { AUTH_DIR, AUTH_FILE } from "./helpers/auth-file";
import { openApp } from "./helpers/app";
import { getSessionUserId } from "./helpers/test-user";

/**
 * Signs in anonymously ONCE per run and stores the session for every test.
 * Supabase rate-limits anonymous sign-ins per IP (30/hour by default); a
 * fresh session per test exhausted that after two or three runs.
 */
export default async function globalSetup(config: FullConfig): Promise<void> {
  const { baseURL, viewport, isMobile, hasTouch, locale, timezoneId, deviceScaleFactor, ignoreHTTPSErrors } =
    config.projects[0].use;

  const browser = await chromium.launch();
  try {
    const context = await browser.newContext({
      baseURL, viewport, isMobile, hasTouch, locale, timezoneId, deviceScaleFactor, ignoreHTTPSErrors,
    });
    const page = await context.newPage();
    await openApp(page); // triggers the anonymous sign-in and waits for the list

    const userId = await getSessionUserId(context);
    if (!userId) throw new Error("[e2e global-setup] no Supabase session cookie after opening the app");

    fs.mkdirSync(AUTH_DIR, { recursive: true });
    await context.storageState({ path: AUTH_FILE });
    console.log(`[e2e global-setup] anonymous test user ${userId} → ${AUTH_FILE}`);
    await context.close();
  } finally {
    await browser.close();
  }
}
