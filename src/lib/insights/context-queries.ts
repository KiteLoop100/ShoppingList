import type { SupabaseClient } from "@supabase/supabase-js";

const CONTEXT_LOOKBACK_DAYS = 90;

export interface ReceiptRow {
  receipt_id: string;
  purchase_date: string | null;
  total_amount: number | null;
  retailer: string | null;
}

export interface ReceiptItemRow {
  receipt_id: string;
  product_id: string | null;
  competitor_product_id: string | null;
  receipt_name: string;
  quantity: number;
  total_price: number | null;
}

export interface ProductRow {
  product_id: string;
  name: string;
  brand: string | null;
  demand_group_code: string | null;
  nutrition_info: unknown;
  is_bio: boolean | null;
  is_vegan: boolean | null;
  is_private_label: boolean | null;
}

export interface TripRow {
  trip_id: string;
  started_at: string;
  completed_at: string;
  total_items: number;
  estimated_total_price: number | null;
}

export interface AutoReorderRow {
  product_id: string;
  reorder_value: number;
  reorder_unit: string;
}

function cutoffDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - CONTEXT_LOOKBACK_DAYS);
  return d.toISOString().slice(0, 10);
}

export async function fetchReceipts(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ receipts: ReceiptRow[]; items: ReceiptItemRow[] }> {
  const cutoff = cutoffDate();
  const { data: receipts, error: rErr } = await supabase
    .from("receipts")
    .select("receipt_id, purchase_date, total_amount, retailer")
    .eq("user_id", userId)
    .gte("purchase_date", cutoff)
    .order("purchase_date", { ascending: false });

  if (rErr) throw new Error(`receipts query failed: ${rErr.message}`);
  if (!receipts?.length) return { receipts: [], items: [] };

  const receiptIds = receipts.map((r: ReceiptRow) => r.receipt_id);
  const { data: items, error: iErr } = await supabase
    .from("receipt_items")
    .select("receipt_id, product_id, competitor_product_id, receipt_name, quantity, total_price")
    .in("receipt_id", receiptIds);

  if (iErr) throw new Error(`receipt_items query failed: ${iErr.message}`);
  return { receipts: receipts as ReceiptRow[], items: (items ?? []) as ReceiptItemRow[] };
}

export async function fetchTrips(
  supabase: SupabaseClient,
  userId: string,
): Promise<TripRow[]> {
  const cutoff = cutoffDate();
  const { data, error } = await supabase
    .from("shopping_trips")
    .select("trip_id, started_at, completed_at, total_items, estimated_total_price")
    .eq("user_id", userId)
    .gte("completed_at", cutoff)
    .order("completed_at", { ascending: false });

  if (error) throw new Error(`shopping_trips query failed: ${error.message}`);
  return (data ?? []) as TripRow[];
}

export async function fetchAutoReorder(
  supabase: SupabaseClient,
  userId: string,
): Promise<AutoReorderRow[]> {
  const { data, error } = await supabase
    .from("auto_reorder_settings")
    .select("product_id, reorder_value, reorder_unit")
    .eq("user_id", userId)
    .eq("is_active", true);

  if (error) throw new Error(`auto_reorder query failed: ${error.message}`);
  return (data ?? []) as AutoReorderRow[];
}

export async function fetchProductDetails(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, ProductRow>> {
  const map = new Map<string, ProductRow>();
  if (productIds.length === 0) return map;

  const unique = [...new Set(productIds)];
  const { data } = await supabase
    .from("products")
    .select("product_id, name, brand, demand_group_code, nutrition_info, is_bio, is_vegan, is_private_label")
    .in("product_id", unique);

  for (const p of (data ?? []) as ProductRow[]) {
    map.set(p.product_id, p);
  }
  return map;
}

export async function fetchCompetitorProductNames(
  supabase: SupabaseClient,
  competitorIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (competitorIds.length === 0) return map;

  const unique = [...new Set(competitorIds)];
  const { data } = await supabase
    .from("competitor_products")
    .select("product_id, name")
    .in("product_id", unique);

  for (const p of (data ?? []) as { product_id: string; name: string }[]) {
    map.set(p.product_id, p.name);
  }
  return map;
}

export async function fetchDemandGroupNames(
  supabase: SupabaseClient,
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  const { data } = await supabase
    .from("demand_groups")
    .select("code, name")
    .eq("is_meta", false);

  for (const g of (data ?? []) as { code: string; name: string }[]) {
    map.set(g.code, g.name);
  }
  return map;
}

export async function fetchAutoReorderProductNames(
  supabase: SupabaseClient,
  productIds: string[],
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (productIds.length === 0) return map;

  const { data } = await supabase
    .from("products")
    .select("product_id, name")
    .in("product_id", [...new Set(productIds)]);

  for (const p of (data ?? []) as { product_id: string; name: string }[]) {
    map.set(p.product_id, p.name);
  }
  return map;
}

export function parseNutritionSafe(raw: unknown): Record<string, number> | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const n = raw as Record<string, unknown>;
  const result: Record<string, number> = {};
  let hasAny = false;
  for (const key of ["energy_kcal", "fat", "carbs", "protein", "sugar", "salt"]) {
    if (typeof n[key] === "number") {
      result[key] = n[key] as number;
      hasAny = true;
    }
  }
  return hasAny ? result : null;
}
