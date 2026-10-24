import { defineConfig } from "@playwright/test";
import dotenv from "dotenv";
import { AUTH_FILE } from "./tests/e2e/helpers/auth-file";

// Service-role key for test-data teardown lives in .env.local (never committed).
dotenv.config({ path: ".env.local" });

/**
 * `npm run dev` serves HTTPS only (`--experimental-https`, self-signed cert in
 * ./certs), so the base URL must be https and certificate errors are ignored.
 */
export const BASE_URL = "https://localhost:3000";

export default defineConfig({
  testDir: "tests/e2e",
  // One anonymous Supabase session per run (rate-limited per IP); tests isolate via DB resets.
  globalSetup: "./tests/e2e/global-setup.ts",
  globalTeardown: "./tests/e2e/global-teardown.ts",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 1,
  workers: 1,
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    storageState: AUTH_FILE,
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "mobile-chrome-de",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 2,
        isMobile: true,
        hasTouch: true,
        locale: "de-DE",
        timezoneId: "Europe/Berlin",
      },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: `${BASE_URL}/de`,
    ignoreHTTPSErrors: true,
    reuseExistingServer: true,
    timeout: 180_000,
  },
});
