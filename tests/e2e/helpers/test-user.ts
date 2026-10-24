import fs from "node:fs";
import type { BrowserContext } from "@playwright/test";

interface CookieLike {
  name: string;
  value: string;
}

/**
 * Extracts the Supabase user id from the session that `@supabase/ssr` stores
 * in the `sb-<project-ref>-auth-token` cookie (optionally chunked `.0`, `.1`, …).
 */
export function userIdFromCookies(cookies: CookieLike[]): string | null {
  const authCookies = cookies
    .filter((c) => /^sb-.*-auth-token(\.\d+)?$/.test(c.name))
    .sort((a, b) => chunkIndex(a.name) - chunkIndex(b.name));
  if (authCookies.length === 0) return null;
  return decodeUserId(authCookies.map((c) => c.value).join(""));
}

export async function getSessionUserId(context: BrowserContext): Promise<string | null> {
  return userIdFromCookies(await context.cookies());
}

/** Reads the user id from a Playwright storageState file; null if the file is missing or has no session. */
export function getStorageStateUserId(file: string): string | null {
  if (!fs.existsSync(file)) return null;
  const state = JSON.parse(fs.readFileSync(file, "utf8")) as { cookies?: CookieLike[] };
  return userIdFromCookies(state.cookies ?? []);
}

function chunkIndex(name: string): number {
  const m = name.match(/\.(\d+)$/);
  return m ? Number(m[1]) : -1;
}

function decodeUserId(raw: string): string | null {
  try {
    const json = raw.startsWith("base64-")
      ? Buffer.from(raw.slice("base64-".length), "base64url").toString("utf8")
      : decodeURIComponent(raw);
    const session = JSON.parse(json) as { user?: { id?: string }; access_token?: string };
    if (session.user?.id) return session.user.id;
    if (session.access_token) {
      const payload = JSON.parse(
        Buffer.from(session.access_token.split(".")[1], "base64url").toString("utf8"),
      ) as { sub?: string };
      return payload.sub ?? null;
    }
    return null;
  } catch {
    return null;
  }
}
