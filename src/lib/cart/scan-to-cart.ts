/**
 * F43 Phase 2: Scan-to-Cart service.
 * Handles the logic when a barcode is scanned in the shopping cart context:
 * match against active list, check off, create extras, handle duplicates.
 */

import type { Product, CompetitorProduct, ListItem } from "@/types";
import { findProductByEan } from "@/lib/products/ean-utils";
import { findCompetitorProductByEan } from "@/lib/competitor-products/competitor-product-service";
import { eanVariants } from "@/lib/products/ean-utils";

export type CartScanResultType =
  | "checked_off"
  | "extra_added"
  | "duplicate_incremented"
  | "product_not_found"
  | "needs_price";

export interface CartScanResult {
  type: CartScanResultType;
  itemId?: string;
  productName?: string;
  newQuantity?: number;
  product?: Product;
  competitorProduct?: CompetitorProduct;
  ean: string;
}

export interface MatchResult {
  listItem: ListItem;
  isAlreadyInCart: boolean;
}

/**
 * Find a list item that matches the given product_id.
 * Returns the item and whether it's already checked (in cart).
 */
export function matchProductToListItem(
  productId: string,
  activeListItems: ListItem[]
): MatchResult | null {
  const match = activeListItems.find((item) => item.product_id === productId);
  if (!match) return null;
  return { listItem: match, isAlreadyInCart: match.is_checked };
}

/**
 * Find a list item that matches any of the given EAN variants directly
 * (for competitor products or items without a product_id match).
 */
export function matchEanToListItem(
  ean: string,
  activeListItems: ListItem[],
  products: Product[]
): MatchResult | null {
  const variants = eanVariants(ean);

  for (const item of activeListItems) {
    if (!item.product_id) continue;
    const product = products.find((p) => p.product_id === item.product_id);
    if (!product?.ean_barcode) continue;
    const pVariants = eanVariants(product.ean_barcode);
    if (variants.some((v) => pVariants.includes(v))) {
      return { listItem: item, isAlreadyInCart: item.is_checked };
    }
  }
  return null;
}

/**
 * Core scan-to-cart logic. Given a scanned EAN:
 * 1. Look up the product (ALDI, competitor, OFF)
 * 2. Match against the active shopping list
 * 3. Return the appropriate action to take
 */
export async function handleCartScan(
  ean: string,
  activeListItems: ListItem[],
  products: Product[],
  competitorProducts: CompetitorProduct[]
): Promise<CartScanResult> {
  const [product, competitor] = await Promise.all([
    findProductByEan(ean, products),
    findCompetitorProductByEan(ean, competitorProducts),
  ]);

  if (product) {
    const match = matchProductToListItem(product.product_id, activeListItems);

    if (match?.isAlreadyInCart) {
      return {
        type: "duplicate_incremented",
        itemId: match.listItem.item_id,
        productName: product.name,
        newQuantity: match.listItem.quantity + 1,
        product,
        ean,
      };
    }

    if (match) {
      return {
        type: "checked_off",
        itemId: match.listItem.item_id,
        productName: product.name,
        product,
        ean,
      };
    }

    if (product.price == null) {
      return {
        type: "needs_price",
        productName: product.name,
        product,
        ean,
      };
    }

    return {
      type: "extra_added",
      productName: product.name,
      product,
      ean,
    };
  }

  if (competitor) {
    const eanMatch = matchEanToListItem(ean, activeListItems, products);
    if (eanMatch?.isAlreadyInCart) {
      return {
        type: "duplicate_incremented",
        itemId: eanMatch.listItem.item_id,
        productName: competitor.name,
        newQuantity: eanMatch.listItem.quantity + 1,
        competitorProduct: competitor,
        ean,
      };
    }
    if (eanMatch) {
      return {
        type: "checked_off",
        itemId: eanMatch.listItem.item_id,
        productName: competitor.name,
        competitorProduct: competitor,
        ean,
      };
    }

    return {
      type: "extra_added",
      productName: competitor.name,
      competitorProduct: competitor,
      ean,
    };
  }

  return { type: "product_not_found", ean };
}
