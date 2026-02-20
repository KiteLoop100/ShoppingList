/**
 * F12: Default store preference (used when GPS does not detect a store).
 * Persisted in localStorage (no user account in MVP).
 */

const KEY = "digital-shopping-list-default-store-id";

export function getDefaultStoreId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setDefaultStoreId(storeId: string | null): void {
  if (typeof window === "undefined") return;
  if (storeId == null) {
    localStorage.removeItem(KEY);
  } else {
    localStorage.setItem(KEY, storeId);
  }
}
