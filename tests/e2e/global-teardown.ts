import fs from "node:fs";
import { AUTH_FILE } from "./helpers/auth-file";
import { getStorageStateUserId } from "./helpers/test-user";
import { cleanupTestUser } from "./helpers/supabase-admin";

/** Deletes the run's anonymous test user and everything it created, then drops the saved session. */
export default async function globalTeardown(): Promise<void> {
  const userId = getStorageStateUserId(AUTH_FILE);
  if (!userId) {
    console.warn("[e2e global-teardown] no stored session found; nothing to clean up");
    return;
  }
  const result = await cleanupTestUser(userId);
  if (result.status === "skipped") {
    console.warn(`[e2e global-teardown] cleanup skipped for ${userId}: ${result.reason}`);
  } else {
    console.log(`[e2e global-teardown] deleted anonymous test user ${userId}`);
  }
  fs.rmSync(AUTH_FILE, { force: true });
}
