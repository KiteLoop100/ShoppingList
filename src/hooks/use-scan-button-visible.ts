/**
 * Determines whether the Scan & Go button should be visible in the footer.
 *
 * Priority order:
 * 1. Cart has items → always visible (Option A: "leave store" scenario)
 * 2. GPS disabled in settings → always visible (user can't be located)
 * 3. GPS error / timeout → visible as fallback
 * 4. GPS says user is in store (< 200m) → visible
 * 5. Default store selected (list has a store, even without GPS) → visible
 * 6. Otherwise (at home, planning, no store) → hidden
 */
export function useScanButtonVisible(
  gpsEnabled: boolean,
  isInStore: boolean,
  gpsError: boolean,
  hasCartItems: boolean,
  hasDefaultStore: boolean,
): boolean {
  if (hasCartItems) return true;
  if (!gpsEnabled) return true;
  if (gpsError) return true;
  if (isInStore) return true;
  if (hasDefaultStore) return true;
  return false;
}
