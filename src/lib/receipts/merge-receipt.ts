/**
 * Merges newly recognized items from a duplicate receipt upload
 * into an existing receipt, avoiding duplicate items.
 */

import { normalizeName, normalizeArticleNumber } from "@/lib/products/normalize";
import { findProductByArticleNumber } from "@/lib/products/find-existing";
import { categorizeCompetitorProductServer } from "@/lib/competitor-products/categorize-competitor-product";
import { log } from "@/lib/utils/logger";
import type { SupabaseClient } from "@supabase/supabase-js";
import { NON_PRODUCT_PATTERN } from "./receipt-prompt";
import type { ReceiptOcrResult, ProcessReceiptResult } from "./parse-receipt";
import { findOrCreateCompetitorProductServer } from "./parse-receipt";
import { upsertInventoryFromReceipt } from "@/lib/inventory/inventory-service";

interface MergeItemInsert {
  receipt_id: string;
  position: number;
  article_number: string | null;
  receipt_name: string;
  product_id: string | null;
  competitor_product_id: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  is_weight_item: boolean;
  weight_kg: number | null;
  tax_category: string | null;
}

export async function mergeIntoExistingReceipt(
  supabase: SupabaseClient,
  userId: string,
  existingReceiptId: string,
  ocrResult: ReceiptOcrResult,
  retailerNormalized: string | null,
  isAldi: boolean,
): Promise<ProcessReceiptResult> {
  const { data: existingItems } = await supabase
    .from("receipt_items")
    .select("receipt_name, article_number")
    .eq("receipt_id", existingReceiptId);

  const existingNames = new Set(
    (existingItems || []).map((i: { receipt_name: string }) => normalizeName(i.receipt_name)),
  );
  const existingArticleNums = new Set(
    (existingItems || [])
      .filter((i: { article_number: string | null }) => i.article_number)
      .map((i: { article_number: string | null }) => normalizeArticleNumber(i.article_number)),
  );

  const products = ocrResult.products || [];
  const newProducts = products.filter((p) => {
    const nameNorm = normalizeName(p.receipt_name || "");
    if (!nameNorm) return false;
    if (existingNames.has(nameNorm)) return false;
    const artNum = normalizeArticleNumber(p.article_number);
    if (artNum && existingArticleNums.has(artNum)) return false;
    return true;
  });

  const existingCount = existingItems?.length || 0;

  if (newProducts.length === 0) {
    log.info("[merge-receipt] Pure duplicate — no new items found");
    return {
      receipt_id: existingReceiptId,
      retailer: retailerNormalized,
      store_name: ocrResult.store_name,
      purchase_date: ocrResult.purchase_date,
      purchase_time: ocrResult.purchase_time,
      total_amount: ocrResult.total_amount,
      items_count: existingCount,
      prices_updated: 0,
      items_linked: 0,
      merged: true,
      items_added: 0,
    };
  }

  log.info(`[merge-receipt] Found ${newProducts.length} new items to merge`);

  const now = new Date().toISOString();
  const newItems: MergeItemInsert[] = [];
  let pricesUpdated = 0;
  const competitorProductIds: string[] = [];
  const startPosition = existingCount + 1;

  for (let idx = 0; idx < newProducts.length; idx++) {
    const p = newProducts[idx];
    const receiptName = (p.receipt_name || "").trim();
    if (!receiptName) continue;

    const isNonProduct = NON_PRODUCT_PATTERN.test(receiptName);
    const articleNumber = normalizeArticleNumber(p.article_number);
    const quantity = typeof p.quantity === "number" && p.quantity > 0 ? p.quantity : 1;
    const unitPrice = typeof p.unit_price === "number" ? p.unit_price : null;
    const totalPrice = typeof p.total_price === "number" ? p.total_price : null;
    const effectivePrice = unitPrice ?? totalPrice;
    let productId: string | null = null;
    let competitorProductId: string | null = null;

    if (!isNonProduct) {
      if (isAldi) {
        const found = await findProductByArticleNumber(
          supabase, articleNumber, "product_id, price, price_updated_at",
        );
        productId = found?.product_id ?? null;

        if (found && effectivePrice != null && ocrResult.purchase_date) {
          const receiptDate = new Date(ocrResult.purchase_date);
          const lastPriceDate = found.price_updated_at
            ? new Date(String(found.price_updated_at))
            : new Date(0);

          if (receiptDate >= lastPriceDate) {
            await supabase
              .from("products")
              .update({
                price: effectivePrice,
                price_updated_at: ocrResult.purchase_date,
                updated_at: now,
              })
              .eq("product_id", productId!);
            pricesUpdated++;
          }
        }
      } else if (retailerNormalized) {
        const result = await findOrCreateCompetitorProductServer(
          supabase, receiptName, "DE", userId, retailerNormalized,
        );
        competitorProductId = result?.productId ?? null;

        if (competitorProductId && effectivePrice != null) {
          await supabase
            .from("competitor_product_prices")
            .insert({
              product_id: competitorProductId,
              retailer: retailerNormalized,
              price: effectivePrice,
              observed_at: ocrResult.purchase_date || now,
              observed_by: userId,
            });
          pricesUpdated++;
          competitorProductIds.push(competitorProductId);
        }

        if (competitorProductId && result?.isNew) {
          categorizeCompetitorProductServer(
            supabase, competitorProductId, receiptName,
            { demandGroupFromAI: p.demand_group },
          ).catch((err) => {
            log.warn("[merge-receipt] Categorization failed (non-blocking):", err);
          });
        }
      }
    }

    newItems.push({
      receipt_id: existingReceiptId,
      position: startPosition + idx,
      article_number: articleNumber,
      receipt_name: receiptName,
      product_id: productId,
      competitor_product_id: competitorProductId,
      quantity,
      unit_price: unitPrice,
      total_price: totalPrice,
      is_weight_item: p.is_weight_item || false,
      weight_kg: typeof p.weight_kg === "number" ? p.weight_kg : null,
      tax_category: p.tax_category || null,
    });
  }

  if (newItems.length > 0) {
    const { error: itemsErr } = await supabase
      .from("receipt_items")
      .insert(newItems);
    if (itemsErr) {
      log.error("[merge-receipt] Insert new items error:", itemsErr);
    }

    const updatedCount = existingCount + newItems.length;
    await supabase
      .from("receipts")
      .update({ items_count: updatedCount })
      .eq("receipt_id", existingReceiptId);

    upsertInventoryFromReceipt(supabase, userId, existingReceiptId, newItems).catch((err) => {
      log.warn("[merge-receipt] Inventory upsert failed (non-blocking):", err);
    });
  }

  if (competitorProductIds.length > 0 && retailerNormalized) {
    const uniqueIds = [...new Set(competitorProductIds)];
    for (const cpId of uniqueIds) {
      supabase
        .from("competitor_product_stats")
        .upsert(
          {
            competitor_product_id: cpId,
            retailer: retailerNormalized,
            user_id: userId,
            purchase_count: 1,
            last_purchased_at: now,
          },
          { onConflict: "competitor_product_id,retailer,user_id" },
        )
        .then(({ error }) => {
          if (error) log.error("[merge-receipt] Stats upsert failed:", error.message);
        });
    }
  }

  const itemsLinked = newItems.filter(
    (i) => i.product_id || i.competitor_product_id,
  ).length;

  return {
    receipt_id: existingReceiptId,
    retailer: retailerNormalized,
    store_name: ocrResult.store_name,
    purchase_date: ocrResult.purchase_date,
    purchase_time: ocrResult.purchase_time,
    total_amount: ocrResult.total_amount,
    items_count: existingCount + newItems.length,
    prices_updated: pricesUpdated,
    items_linked: itemsLinked,
    merged: true,
    items_added: newItems.length,
  };
}
