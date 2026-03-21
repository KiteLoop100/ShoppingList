import type { User } from "@supabase/supabase-js";

/**
 * True when the user should see the "logged in with email" account UI (vs anonymous / no account).
 * Used after signOut to detect a stale registered session that should not remain.
 */
export function looksLikeRegisteredAccountUser(user: Pick<User, "email" | "is_anonymous">): boolean {
  return Boolean(user.email) && user.is_anonymous !== true;
}
