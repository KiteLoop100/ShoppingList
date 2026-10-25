import { test as base } from "@playwright/test";
import { AUTH_FILE } from "./helpers/auth-file";
import { getStorageStateUserId } from "./helpers/test-user";
import { clearUserListData } from "./helpers/supabase-admin";

/**
 * All tests share the anonymous session created by global-setup (storageState
 * in playwright.config.ts). Isolation comes from the database instead: before
 * each test the test user's list data is wiped (service role), so every test
 * starts from an empty list. The user itself is deleted in global-teardown.
 */
export const test = base.extend<{ emptyList: void }>({
  emptyList: [
    async ({}, use) => {
      const userId = getStorageStateUserId(AUTH_FILE);
      if (!userId) {
        throw new Error(`[e2e] no test session in ${AUTH_FILE} — did global-setup run?`);
      }
      await clearUserListData(userId);
      await use();
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
