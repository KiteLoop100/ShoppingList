import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

/** Only anonymous users created within this window may be deleted by the teardown. */
const MAX_TEST_USER_AGE_MS = 6 * 60 * 60 * 1000;

/** Shopping-list data of a user. Order matters: checkoff_sequences → trips; list_items cascade from shopping_lists. */
const LIST_TABLES = ["checkoff_sequences", "shopping_trips", "shopping_lists"] as const;

/** Everything user-owned the core flows can touch that is NOT cascaded from auth.users. */
const USER_OWNED_TABLES = [...LIST_TABLES, "user_settings", "auto_reorder_settings"] as const;

export interface CleanupResult {
  status: "deleted" | "skipped";
  reason?: string;
}

export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function requireAdminClient(): SupabaseClient {
  const admin = createAdminClient();
  if (!admin) {
    throw new Error("[e2e] SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing in .env.local");
  }
  return admin;
}

async function deleteRowsOfUser(admin: SupabaseClient, tables: readonly string[], userId: string): Promise<void> {
  for (const table of tables) {
    const { error } = await admin.from(table).delete().eq("user_id", userId);
    if (error) throw new Error(`[e2e cleanup] delete from ${table} failed: ${error.message}`);
  }
}

/** Removes all shopping-list data (lists, items, trips, check-off sequences) of the test user. */
export async function clearUserListData(userId: string): Promise<void> {
  await deleteRowsOfUser(requireAdminClient(), LIST_TABLES, userId);
}

/**
 * Deletes everything the given anonymous test user created, then the auth user itself.
 * Refuses to touch anything that is not a recently created anonymous user.
 */
export async function cleanupTestUser(userId: string): Promise<CleanupResult> {
  const admin = createAdminClient();
  if (!admin) {
    return { status: "skipped", reason: "SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL missing in .env.local" };
  }

  const { data, error } = await admin.auth.admin.getUserById(userId);
  if (error || !data.user) {
    return { status: "skipped", reason: `user lookup failed: ${error?.message ?? "not found"}` };
  }
  const user = data.user;
  if (!user.is_anonymous) {
    return { status: "skipped", reason: "refusing to delete a non-anonymous user" };
  }
  const ageMs = Date.now() - new Date(user.created_at).getTime();
  if (!(ageMs >= 0 && ageMs < MAX_TEST_USER_AGE_MS)) {
    return { status: "skipped", reason: `refusing to delete a user created ${Math.round(ageMs / 60000)} min ago` };
  }

  await deleteRowsOfUser(admin, USER_OWNED_TABLES, userId);

  const { error: userDelError } = await admin.auth.admin.deleteUser(userId);
  if (userDelError) {
    throw new Error(`[e2e cleanup] deleteUser failed: ${userDelError.message}`);
  }
  return { status: "deleted" };
}
