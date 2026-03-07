/**
 * Receipt OCR parsing and product processing logic.
 * Called by the process-receipt API route handler.
 */

import { normalizeName, normalizeArticleNumber } from "@/lib/products/normalize";
import fs from "fs";
import nodePath from "path";
import { findProductByArticleNumber } from "@/lib/products/find-existing";

// #region agent log
function dbgLog(hypothesisId: string, message: string, data?: unknown) {
  try {
    const logPath = nodePath.join(process.cwd(), "debug-4c9d8e.log");
    const entry = JSON.stringify({ sessionId: "4c9d8e", timestamp: Date.now(), hypothesisId, message, data }) + "\n";
    fs.appendFileSync(logPath, entry);
  } catch { /* best effort */ }
}
// #endregion
import { categorizeCompetitorProductServer } from "@/lib/competitor-products/categorize-competitor-product";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { callClaude, parseClaudeJsonResponse } from "@/lib/api/claude-client";
import { log } from "@/lib/utils/logger";
import { isHomeRetailer, normalizeRetailerName } from "@/lib/retailers/retailers";
import type { SupabaseClient } from "@supabase/supabase-js";
import { RECEIPT_PROMPT, NON_PRODUCT_PATTERN } from "./receipt-prompt";

export interface ReceiptProduct {
  position: number;
  article_number?: string | null;
  receipt_name: string;
  quantity?: number;
  unit_price?: number | null;
  total_price?: number | null;
  is_weight_item?: boolean;
  weight_kg?: number | null;
  tax_category?: string | null;
  demand_group?: string | null;
}

export interface ReceiptOcrResult {
  status: "valid" | "unsupported_retailer" | "not_a_receipt";
  retailer?: string | null;
  store_name?: string | null;
  store_address?: string | null;
  purchase_date?: string | null;
  purchase_time?: string | null;
  receipt_number?: string | null;
  cashier?: string | null;
  payment_method?: string | null;
  total_amount?: number | null;
  currency?: string;
  products?: ReceiptProduct[];
  tax_details?: unknown[];
  extra_info?: Record<string, unknown>;
}

export interface ProcessReceiptResult {
  receipt_id: string;
  retailer: string | null;
  store_name: string | null | undefined;
  purchase_date: string | null | undefined;
  purchase_time: string | null | undefined;
  total_amount: number | null | undefined;
  items_count: number;
  prices_updated: number;
  items_linked: number;
}

interface ReceiptItemInsert {
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

/** Delete uploaded receipt photos from storage (fire-and-forget). */
export function cleanupPhotos(supabase: SupabaseClient, photoPaths: string[]) {
  if (photoPaths.length === 0) return;
  supabase.storage
    .from("receipt-photos")
    .remove(photoPaths)
    .then(({ error }) => {
      if (error) log.error("[process-receipt] Photo cleanup failed:", error.message);
    });
}

/** Call Claude with receipt images and return the parsed OCR result. */
export async function callReceiptOcr(photoUrls: string[]): Promise<ReceiptOcrResult> {
  const imageContent = photoUrls.map((url) => ({
    type: "image" as const,
    source: { type: "url" as const, url },
  }));
  const rawText = await callClaude({
    model: CLAUDE_MODEL_SONNET,
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          ...imageContent,
          { type: "text", text: RECEIPT_PROMPT },
        ],
      },
    ],
  });

  return parseClaudeJsonResponse<ReceiptOcrResult>(rawText);
}

async function findOrCreateCompetitorProductServer(
  supabase: SupabaseClient, receiptName: string, country: string,
  userId: string, retailer: string | null,
): Promise<{ productId: string; isNew: boolean } | null> {
  const nameNorm = normalizeName(receiptName);
  const { data: existing } = await supabase
    .from("competitor_products")
    .select("product_id, retailer")
    .eq("name_normalized", nameNorm)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  if (existing) {
    if (retailer && !existing.retailer) {
      await supabase
        .from("competitor_products")
        .update({ retailer, updated_at: new Date().toISOString() })
        .eq("product_id", existing.product_id);
    }
    return { productId: existing.product_id, isNew: false };
  }

  const { data: created, error } = await supabase
    .from("competitor_products")
    .insert({
      name: receiptName,
      name_normalized: nameNorm,
      country,
      created_by: userId,
      retailer: retailer ?? null,
    })
    .select("product_id")
    .single();

  if (error) {
    log.error("[process-receipt] Failed to create competitor product:", error.message);
    return null;
  }
  return { productId: created.product_id, isNew: true };
}

/** Process a validated receipt: insert record, match products, insert items, update prices. */
export async function processValidReceipt(
  supabase: SupabaseClient, userId: string, ocrResult: ReceiptOcrResult,
  photoUrls: string[], photoPaths: string[],
): Promise<ProcessReceiptResult> {
  const retailerRaw = ocrResult.retailer || ocrResult.store_name || "";
  const retailerNormalized = normalizeRetailerName(retailerRaw);
  const isAldi = retailerNormalized ? isHomeRetailer(retailerNormalized) : false;

  const products = ocrResult.products || [];
  const now = new Date().toISOString();
  const receiptNumber = ocrResult.receipt_number || null;

  // #region agent log
  dbgLog("H-2A,H-2B", "about to INSERT receipt", { userId, receiptNumber, purchaseDate: ocrResult.purchase_date, totalAmount: ocrResult.total_amount, storeName: ocrResult.store_name, ts: Date.now() });
  // #endregion

  const throwDuplicate = (receiptId: string, reason: string) => {
    // #region agent log
    dbgLog("H-2A", `DUPLICATE DETECTED (${reason})`, { existingId: receiptId, receiptNumber });
    // #endregion
    cleanupPhotos(supabase, photoPaths);
    throw Object.assign(new Error("duplicate_receipt"), { code: "duplicate_receipt", receipt_id: receiptId });
  };

  if (receiptNumber) {
    const { data: existing } = await supabase
      .from("receipts")
      .select("receipt_id")
      .eq("user_id", userId)
      .eq("receipt_number", receiptNumber)
      .limit(1)
      .maybeSingle();

    if (existing) throwDuplicate(existing.receipt_id, "receipt_number");
  }

  if (retailerNormalized && ocrResult.purchase_date && typeof ocrResult.total_amount === "number") {
    let query = supabase
      .from("receipts")
      .select("receipt_id")
      .eq("user_id", userId)
      .eq("retailer", retailerNormalized)
      .eq("purchase_date", ocrResult.purchase_date)
      .eq("total_amount", ocrResult.total_amount);

    if (ocrResult.purchase_time) {
      query = query.eq("purchase_time", ocrResult.purchase_time);
    }

    const { data: existing } = await query.limit(1).maybeSingle();
    if (existing) throwDuplicate(existing.receipt_id, "retailer+date+amount");
  }

  const { data: receiptRow, error: receiptErr } = await supabase
    .from("receipts")
    .insert({
      user_id: userId,
      store_name: ocrResult.store_name || null,
      store_address: ocrResult.store_address || null,
      retailer: retailerNormalized,
      purchase_date: ocrResult.purchase_date || null,
      purchase_time: ocrResult.purchase_time || null,
      receipt_number: receiptNumber,
      total_amount: typeof ocrResult.total_amount === "number" ? ocrResult.total_amount : null,
      payment_method: ocrResult.payment_method || null,
      currency: ocrResult.currency || "EUR",
      photo_urls: photoPaths.length > 0 ? photoPaths : photoUrls,
      raw_ocr_data: ocrResult,
      extra_info: ocrResult.extra_info || null,
      items_count: products.length,
      created_at: now,
    })
    .select("receipt_id")
    .single();

  // #region agent log
  dbgLog("H-2A,H-1A", "INSERT receipt result", { receiptId: receiptRow?.receipt_id, error: receiptErr?.message });
  // #endregion

  if (receiptErr || !receiptRow) {
    throw new Error(`Failed to save receipt: ${receiptErr?.message}`);
  }

  const receiptId = receiptRow.receipt_id;
  const receiptItems: ReceiptItemInsert[] = [];

  let pricesUpdated = 0;
  const competitorProductIds: string[] = [];

  for (const p of products) {
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
          supabase,
          articleNumber,
          "product_id, price, price_updated_at",
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
            log.warn("[process-receipt] Categorization failed (non-blocking):", err);
          });
        }
      }
    }

    receiptItems.push({
      receipt_id: receiptId,
      position: p.position || receiptItems.length + 1,
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

  if (receiptItems.length > 0) {
    const { error: itemsErr } = await supabase
      .from("receipt_items")
      .insert(receiptItems);
    if (itemsErr) {
      log.error("[process-receipt] Receipt items insert error:", itemsErr);
    }
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
          { onConflict: "competitor_product_id,retailer,user_id" }
        )
        .then(({ error }) => {
          if (error) log.error("[process-receipt] Stats upsert failed:", error.message);
        });
    }
  }

  const itemsLinked = receiptItems.filter(
    (i) => i.product_id || i.competitor_product_id
  ).length;

  return {
    receipt_id: receiptId,
    retailer: retailerNormalized,
    store_name: ocrResult.store_name,
    purchase_date: ocrResult.purchase_date,
    purchase_time: ocrResult.purchase_time,
    total_amount: ocrResult.total_amount,
    items_count: receiptItems.length,
    prices_updated: pricesUpdated,
    items_linked: itemsLinked,
  };
}
