/**
 * Stable device/user ID for anonymous MVP use.
 * Stored in localStorage so the same device always gets the same user_id.
 */

const KEY = "digital-shopping-list-device-id";

function generateId(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return "dev-" + Date.now() + "-" + Math.random().toString(36).slice(2, 11);
}

export function getDeviceUserId(): string {
  if (typeof window === "undefined") return "anonymous";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = generateId();
    localStorage.setItem(KEY, id);
  }
  return id;
}
