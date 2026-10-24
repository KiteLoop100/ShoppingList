/**
 * SSRF-safe fetch for user-supplied URLs (e.g. recipe import).
 *
 * `fetch(url, { redirect: "follow" })` validates only the first URL; a public
 * host can still 302 the server to a private IP or cloud metadata endpoint.
 * This helper follows redirects manually, re-validating EVERY hop with
 * {@link validateExternalUrl}, caps the number of hops and enforces one total
 * timeout across all hops.
 */

import { validateExternalUrl } from "@/lib/api/validate-url";

export const SAFE_FETCH_MAX_REDIRECTS = 3;
export const SAFE_FETCH_TIMEOUT_MS = 15_000;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

/** Thrown when the URL (or a redirect target) fails validation. */
export class UnsafeUrlError extends Error {
  constructor(detail: string) {
    super(`Unsafe URL: ${detail}`);
    this.name = "UnsafeUrlError";
  }
}

export interface SafeFetchOptions {
  headers?: Record<string, string>;
  maxRedirects?: number;
  timeoutMs?: number;
}

function assertSafe(url: string): URL {
  try {
    return validateExternalUrl(url);
  } catch (e) {
    throw new UnsafeUrlError(e instanceof Error ? e.message : String(e));
  }
}

/**
 * GET `url` and return the final (non-redirect) response.
 * Throws {@link UnsafeUrlError} if any hop is not a safe public HTTPS URL,
 * or a plain Error when the redirect limit or timeout is exceeded.
 */
export async function safeFetch(
  url: string,
  options: SafeFetchOptions = {},
): Promise<Response> {
  const maxRedirects = options.maxRedirects ?? SAFE_FETCH_MAX_REDIRECTS;
  const timeoutMs = options.timeoutMs ?? SAFE_FETCH_TIMEOUT_MS;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    let current = assertSafe(url);

    for (let hop = 0; ; hop++) {
      let res: Response;
      try {
        res = await fetch(current.href, {
          method: "GET",
          redirect: "manual",
          headers: options.headers,
          signal: controller.signal,
        });
      } catch (e) {
        if (controller.signal.aborted) {
          throw new Error(`Failed to fetch URL: timeout after ${timeoutMs} ms`);
        }
        throw e;
      }

      if (!REDIRECT_STATUSES.has(res.status)) return res;

      const location = res.headers.get("location");
      if (!location) return res;
      if (hop >= maxRedirects) {
        throw new Error(`Too many redirects (max ${maxRedirects})`);
      }
      // Resolve relative Location headers against the current URL, then
      // validate the target exactly like the original URL.
      current = assertSafe(new URL(location, current).href);
    }
  } finally {
    clearTimeout(timer);
  }
}
