/**
 * Ownership check for receipt photo storage paths.
 *
 * `/api/process-receipt` deletes `photo_paths` from the `receipt-photos`
 * bucket with the service role (bypassing storage RLS), so a path must be
 * verified to live in the caller's own folder before any storage call.
 */

/** True when `path` is `<userId>/<...>` without empty or traversal segments. */
export function isOwnStoragePath(path: string, userId: string): boolean {
  if (!userId || !path.startsWith(`${userId}/`)) return false;
  const segments = path.split("/");
  return (
    segments.length >= 2 &&
    segments.every((s) => s !== "" && s !== "." && s !== "..")
  );
}

/** Returns the first path that is NOT owned by `userId`, or null if all are. */
export function findForeignStoragePath(paths: string[], userId: string): string | null {
  return paths.find((p) => !isOwnStoragePath(p, userId)) ?? null;
}
