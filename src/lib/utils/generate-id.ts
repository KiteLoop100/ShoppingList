/**
 * Generate a UUID v4, with fallback for environments without crypto.randomUUID
 * (e.g. non-secure HTTP contexts where crypto.randomUUID is unavailable).
 */
export function generateId(prefix?: string): string {
  let uuid: string;
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    uuid = crypto.randomUUID();
  } else if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    uuid = `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  } else {
    const h = () => Math.floor(Math.random() * 0x10000).toString(16).padStart(4, "0");
    uuid = `${h()}${h()}-${h()}-4${h().slice(1)}-${(8 + Math.floor(Math.random() * 4)).toString(16)}${h().slice(1)}-${h()}${h()}${h()}`;
  }
  return prefix ? `${prefix}-${uuid.slice(0, 8)}` : uuid;
}
