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
  | "partial_checkoff"
  | "extra_added"
  | "duplicate_incremented"
  | "product_not_found"
  | "needs_price";

export interface CartScanResult {
  type: CartScanResultType;
  itemId?: string;
  productName?: string;
  newQuantity?: number;
  /** For partial_checkoff: the remaining quantity on the unchecked list item. */
  remainingQuantity?: number;
  product?: Product;
  competitorProduct?: CompetitorProduct;
  ean: string;
}

export interface MatchResult {
  listItem: ListItem;
  isAlreadyInCart: boolean;
}

export interface FullMatchResult {
  uncheckedItem: ListItem | null;
  checkedItem: ListItem | null;
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
 * Find both unchecked and checked items matching a product_id.
 * Used by scan-to-cart to handle partial check-off (quantity splitting).
 */
export function matchProductToListItems(
  productId: string,
  activeListItems: ListItem[]
): FullMatchResult {
  let uncheckedItem: ListItem | null = null;
  let checkedItem: ListItem | null = null;
  for (const item of activeListItems) {
    if (item.product_id !== productId) continue;
    if (item.is_checked) { checkedItem ??= item; }
    else { uncheckedItem ??= item; }
  }
  return { uncheckedItem, checkedItem };
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
 * 1. Look up the product (ALDI, competitor, OFF) — or use a pre-resolved product
 * 2. Match against the active shopping list
 * 3. Return the appropriate action to take
 *
 * When `knownProduct` is provided (e.g. from BarcodeScannerModal which already
 * did the lookup), the EAN-based lookup is skipped for that product type.
 */
export async function handleCartScan(
  ean: string,
  activeListItems: ListItem[],
  products: Product[],
  competitorProducts: CompetitorProduct[],
  knownProduct?: Product,
): Promise<CartScanResult> {
  const [product, competitor] = knownProduct
    ? [knownProduct, null]
    : await Promise.all([
        findProductByEan(ean, products),
        findCompetitorProductByEan(ean, competitorProducts),
      ]);

  if (product) {
    const { uncheckedItem, checkedItem } = matchProductToListItems(
      product.product_id,
      activeListItems,
    );

    if (uncheckedItem) {
      if (uncheckedItem.quantity > 1) {
        return {
          type: "partial_checkoff",
          itemId: uncheckedItem.item_id,
          productName: product.name,
          remainingQuantity: uncheckedItem.quantity - 1,
          newQuantity: checkedItem ? checkedItem.quantity + 1 : 1,
          product,
          ean,
        };
      }
      if (checkedItem) {
        return {
          type: "partial_checkoff",
          itemId: uncheckedItem.item_id,
          productName: product.name,
          remainingQuantity: 0,
          newQuantity: checkedItem.quantity + 1,
          product,
          ean,
        };
      }
      return {
        type: "checked_off",
        itemId: uncheckedItem.item_id,
        productName: product.name,
        product,
        ean,
      };
    }

    if (checkedItem) {
      return {
        type: "duplicate_incremented",
        itemId: checkedItem.item_id,
        productName: product.name,
        newQuantity: checkedItem.quantity + 1,
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
