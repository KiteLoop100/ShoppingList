/**
 * BL-72: Retailer Memory — remembers which retailer the user last chose
 * for a given product. Stored in localStorage with FIFO eviction.
 *
 * Follows the same synchronous localStorage pattern as product-preferences.ts.
 */

const STORAGE_KEY = "retailer-memory";
const MAX_ENTRIES = 500;

interface RetailerMemoryData {
  map: Record<string, string>;
  order: string[];
}

const EMPTY_DATA: RetailerMemoryData = { map: {}, order: [] };

export function productKey(
  productId: string | null,
  displayName: string,
): string {
  if (productId) return `pid:${productId}`;
  return `name:${displayName.toLowerCase().trim()}`;
}

function readStorage(): RetailerMemoryData {
  if (typeof window === "undefined") return { ...EMPTY_DATA, map: {}, order: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { map: {}, order: [] };
    const parsed = JSON.parse(raw) as Partial<RetailerMemoryData>;
    const map = parsed.map && typeof parsed.map === "object" ? parsed.map : {};
    const order = Array.isArray(parsed.order) ? parsed.order : Object.keys(map);
    return { map: map as Record<string, string>, order };
  } catch {
    return { map: {}, order: [] };
  }
}

function writeStorage(data: RetailerMemoryData): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function getRetailerForProduct(
  productId: string | null,
  displayName: string,
): string | null {
  const key = productKey(productId, displayName);
  const data = readStorage();
  return data.map[key] ?? null;
}

export function setRetailerForProduct(
  productId: string | null,
  displayName: string,
  retailer: string,
): void {
  const key = productKey(productId, displayName);
  const data = readStorage();

  const existingIdx = data.order.indexOf(key);
  if (existingIdx !== -1) {
    data.order.splice(existingIdx, 1);
  }

  data.map[key] = retailer;
  data.order.push(key);

  if (data.order.length > MAX_ENTRIES) {
    const removeCount = data.order.length - MAX_ENTRIES;
    const removed = data.order.splice(0, removeCount);
    for (const k of removed) {
      delete data.map[k];
    }
  }

  writeStorage(data);
}
