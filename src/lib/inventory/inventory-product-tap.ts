import type { InventoryItem } from "./inventory-types";
import type { Product } from "@/types";

/** ALDI product to show in product details when the user taps an inventory row name. */
export function findAldiProductForInventoryItem(
  item: InventoryItem,
  products: Product[],
): Product | null {
  if (!item.product_id) return null;
  return products.find((p) => p.product_id === item.product_id) ?? null;
}
