/**
 * DRY wrapper for the recurring createClientIfConfigured() guard + error handling pattern.
 *
 * Usage:
 *   const items = await withSupabase(
 *     (sb) => sb.from("products").select("*").eq("status", "active"),
 *     { fallback: [], context: "[products]" }
 *   );
 */

import type { SupabaseClient, PostgrestError } from "@supabase/supabase-js";
import { createClientIfConfigured } from "./client";
import { log } from "@/lib/utils/logger";

export async function withSupabase<T>(
  fn: (client: SupabaseClient) => PromiseLike<{ data: T | null; error: PostgrestError | null }>,
  options: { fallback: T; context: string },
): Promise<T> {
  const sb = createClientIfConfigured();
  if (!sb) return options.fallback;

  try {
    const { data, error } = await fn(sb);
    if (error) {
      log.warn(`${options.context} Supabase error:`, error.message);
      return options.fallback;
    }
    return data ?? options.fallback;
  } catch (e) {
    log.warn(`${options.context} unexpected error:`, e);
    return options.fallback;
  }
}
