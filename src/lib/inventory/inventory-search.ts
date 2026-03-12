import type { InventoryItem } from "./inventory-types";

/**
 * Filter inventory items by display_name substring match (case-insensitive).
 * Returns all items if query is empty/blank.
 */
export function filterInventoryByName(
  items: InventoryItem[],
  query: string,
): InventoryItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return items;
  return items.filter((item) =>
    item.display_name.toLowerCase().includes(trimmed),
  );
}
