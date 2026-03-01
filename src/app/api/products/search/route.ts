/**
 * Produktsuche per Supabase: name, name_normalized, ean_barcode, article_number (OR).
 * Wird genutzt wenn der Client keine Produkte aus dem Context hat oder als Fallback.
 */

import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/api/guards";
import { validateSearchParams } from "@/lib/api/validate-request";
import { productSearchSchema } from "@/lib/api/schemas";
import { generalRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { log } from "@/lib/utils/logger";

/** Escape for use in .or() ilike pattern; Komma entfernen damit .or() nicht zerbricht. */
function safePattern(s: string): string {
  const escaped = s
    .replace(/\\/g, "\\\\")
    .replace(/%/g, "\\%")
    .replace(/_/g, "\\_")
    .replace(/,/g, " ");
  return `%${escaped}%`;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const validated = validateSearchParams(searchParams, productSearchSchema);
  if (validated instanceof NextResponse) return validated;
  const { q, country, limit } = validated;

  const identifier = getIdentifier(request);
  const rateLimited = await checkRateLimit(generalRateLimit, identifier);
  if (rateLimited) return rateLimited;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const pattern = safePattern(q);
  const qDigits = q.replace(/\D/g, "");

  let query = supabase
    .from("products")
    .select("product_id, name, name_normalized, category_id, price, status, country, categories(name)")
    .eq("status", "active")
    .eq("country", country)
    .limit(limit * 3);

  if (qDigits.length >= 8) {
    query = query.or(
      `name.ilike.${pattern},name_normalized.ilike.${pattern},ean_barcode.eq.${qDigits},article_number.ilike.${pattern}`
    );
  } else {
    query = query.or(
      `name.ilike.${pattern},name_normalized.ilike.${pattern},article_number.ilike.${pattern}`
    );
  }

  const { data, error } = await query;

  if (error) {
    log.error("[products/search]", error.message);
    return NextResponse.json({ error: error.message }, { status: 502 });
  }

  const rows = (data ?? []).slice(0, limit);
  const products = rows.map((row: Record<string, unknown>) => {
    const cat = row.categories;
    const categoryName =
      Array.isArray(cat) && cat[0] != null && typeof (cat[0] as Record<string, unknown>).name === "string"
        ? (cat[0] as Record<string, unknown>).name
        : cat != null && typeof cat === "object" && !Array.isArray(cat) && typeof (cat as Record<string, unknown>).name === "string"
          ? (cat as Record<string, unknown>).name
          : "";
    return {
      product_id: row.product_id,
      name: row.name,
      category_id: row.category_id,
      category_name: categoryName,
      price: row.price,
    };
  });
  return NextResponse.json({ products });
}
