/**
 * Supabase admin client with service role for server-side use (API routes).
 * Bypasses RLS – use only in trusted server code.
 */

import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";

let adminClient: SupabaseClient | null = null;

export function createAdminClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!adminClient) {
    adminClient = createClient(url, key, { auth: { persistSession: false } });
  }
  return adminClient;
}
