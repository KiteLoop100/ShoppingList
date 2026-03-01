const KEY = "digital-shopping-list-device-id";

export function getOldDeviceId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}
