/**
 * Supabase server client for API Route Handlers.
 * Reads the user session from request cookies (set by @supabase/ssr browser client).
 * Uses the anon key so RLS policies are respected.
 */

import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

function parseCookies(
  cookieHeader: string
): { name: string; value: string }[] {
  if (!cookieHeader) return [];
  return cookieHeader.split(";").map((c) => {
    const [name, ...rest] = c.trim().split("=");
    return { name, value: rest.join("=") };
  });
}

/**
 * Create a Supabase client that carries the caller's auth session.
 * Cookie-based: the browser client (@supabase/ssr) stores the session
 * in sb-* cookies which are sent automatically with same-origin fetch().
 */
export function createSupabaseServerFromRequest(
  request: Request
): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  const cookieHeader = request.headers.get("cookie") ?? "";
  const requestCookies = parseCookies(cookieHeader);

  return createServerClient(url, key, {
    cookies: {
      getAll() {
        return requestCookies;
      },
      setAll() {
        // Token refresh is handled by the browser client;
        // route handlers only verify the existing session.
      },
    },
  });
}
