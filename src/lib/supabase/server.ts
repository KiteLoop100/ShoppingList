/**
 * Supabase server client for API Route Handlers.
 * Reads the user session from request cookies (set by @supabase/ssr browser client).
 * Uses the anon key so RLS policies are respected.
 */

import { createServerClient, type CookieOptions } from "@supabase/ssr";
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
 *
 * When `responseHeaders` is provided, refreshed session cookies are
 * written back to the response. Without it, token refresh is silently
 * skipped (read-only mode for lightweight auth checks).
 */
export function createSupabaseServerFromRequest(
  request: Request,
  responseHeaders?: Headers
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
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        if (!responseHeaders) return;
        for (const { name, value, options } of cookiesToSet) {
          const parts = [`${name}=${value}`];
          if (options?.path) parts.push(`Path=${options.path}`);
          if (options?.maxAge != null) parts.push(`Max-Age=${options.maxAge}`);
          if (options?.httpOnly) parts.push("HttpOnly");
          if (options?.secure) parts.push("Secure");
          if (options?.sameSite) parts.push(`SameSite=${options.sameSite}`);
          responseHeaders.append("Set-Cookie", parts.join("; "));
        }
      },
    },
  });
}
