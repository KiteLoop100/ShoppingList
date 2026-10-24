/**
 * process-photo fetches `photo_url` server-side. To prevent SSRF and use of
 * the endpoint as an open proxy, the URL must be a public object in THIS
 * project's Supabase Storage (exact host match), not just any HTTPS URL.
 */

import { validateExternalUrl } from "@/lib/api/validate-url";

const STORAGE_PUBLIC_PATH_PREFIX = "/storage/v1/object/public/";

/**
 * Returns the parsed URL when `photoUrl` is a public Supabase Storage object of
 * this project. Throws a descriptive Error otherwise (generic HTTPS/SSRF
 * checks first, then exact-host and path-prefix checks).
 *
 * @param supabaseUrl Defaults to NEXT_PUBLIC_SUPABASE_URL (injectable for tests).
 */
export function validateStoragePhotoUrl(
  photoUrl: string,
  supabaseUrl: string | undefined = process.env.NEXT_PUBLIC_SUPABASE_URL,
): URL {
  const parsed = validateExternalUrl(photoUrl);

  if (!supabaseUrl) {
    throw new Error("Supabase URL not configured");
  }
  const allowedHost = new URL(supabaseUrl).host.toLowerCase();

  if (parsed.host.toLowerCase() !== allowedHost) {
    throw new Error("photo_url must point to this project's Supabase storage");
  }
  if (!parsed.pathname.startsWith(STORAGE_PUBLIC_PATH_PREFIX)) {
    throw new Error("photo_url must be a public storage object URL");
  }
  if (parsed.username || parsed.password) {
    throw new Error("photo_url must not contain credentials");
  }
  return parsed;
}
