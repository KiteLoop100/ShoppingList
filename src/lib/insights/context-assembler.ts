import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/utils/logger";
import {
  fetchReceipts,
  fetchTrips,
  fetchAutoReorder,
  fetchProductDetails,
  fetchCompetitorProductNames,
  fetchDemandGroupNames,
  fetchAutoReorderProductNames,
  parseNutritionSafe,
} from "./context-queries";

const MAX_TOP_PRODUCTS = 20;
const MAX_CATEGORIES = 10;
const MAX_WEEKLY_SPENDING = 12;
const MAX_AUTO_REORDER = 10;

export interface UserShoppingContext {
  receipt_count: number;
  date_range: { from: string; to: string };
  total_spent: number;
  avg_per_trip: number;
  shopping_frequency_per_week: number;
  top_products: { name: string; count: number; total_spent: number }[];
  category_breakdown: { group: string; spent: number; items: number }[];
  nutrition_summary?: {
    products_with_data: number;
    products_total: number;
    avg_energy_kcal?: number;
    avg_fat?: number;
    avg_carbs?: number;
    avg_protein?: number;
    avg_sugar?: number;
    avg_salt?: number;
  };
  weekly_spending: { week: string; amount: number }[];
  organic_ratio: number;
  vegan_ratio: number;
  auto_reorder_items: { name: string; interval: string }[];
  trip_count: number;
}

export async function assembleInsightContext(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserShoppingContext> {
  const [receiptsResult, tripsResult, autoReorderResult] = await Promise.allSettled([
    fetchReceipts(supabase, userId),
    fetchTrips(supabase, userId),
    fetchAutoReorder(supabase, userId),
  ]);

  const { receipts, items } =
    receiptsResult.status === "fulfilled" ? receiptsResult.value : { receipts: [], items: [] };
  const trips = tripsResult.status === "fulfilled" ? tripsResult.value : [];
  const autoReorder = autoReorderResult.status === "fulfilled" ? autoReorderResult.value : [];

  if (receiptsResult.status === "rejected") {
    log.warn("[insights] receipts query failed:", receiptsResult.reason);
  }
  if (tripsResult.status === "rejected") {
    log.warn("[insights] trips query failed:", tripsResult.reason);
  }
  if (autoReorderResult.status === "rejected") {
    log.warn("[insights] auto_reorder query failed:", autoReorderResult.reason);
  }

  const productIds = items.filter((i) => i.product_id).map((i) => i.product_id!);
  const competitorIds = items.filter((i) => i.competitor_product_id).map((i) => i.competitor_product_id!);
  const autoReorderProductIds = autoReorder.map((a) => a.product_id);

  const [productMap, competitorNames, demandGroupNames, autoReorderNames] = await Promise.all([
    fetchProductDetails(supabase, productIds),
    fetchCompetitorProductNames(supabase, competitorIds),
    fetchDemandGroupNames(supabase),
    fetchAutoReorderProductNames(supabase, autoReorderProductIds),
  ]);

  const totalSpent = receipts.reduce((sum, r) => sum + (r.total_amount ?? 0), 0);
  const receiptCount = receipts.length;
  const avgPerTrip = receiptCount > 0 ? totalSpent / receiptCount : 0;

  const dates = receipts
    .map((r) => r.purchase_date)
    .filter((d): d is string => d !== null)
    .sort();
  const dateRange = {
    from: dates[0] ?? "",
    to: dates[dates.length - 1] ?? "",
  };

  const weeks = (dates.length >= 2)
    ? (new Date(dates[dates.length - 1]).getTime() - new Date(dates[0]).getTime()) / (7 * 86400000)
    : 1;
  const shoppingFreq = receiptCount / Math.max(weeks, 1);

  const productFreq = new Map<string, { name: string; count: number; spent: number }>();
  const categorySpend = new Map<string, { spent: number; items: number }>();
  let bioCount = 0;
  let veganCount = 0;
  let totalProductItems = 0;
  const nutritionAccum: Record<string, { sum: number; count: number }> = {};
  let productsWithNutrition = 0;

  for (const item of items) {
    const pid = item.product_id ?? item.competitor_product_id;
    let name = item.receipt_name;
    let demandGroup: string | null = null;
    let isBio = false;
    let isVegan = false;
    let nutritionRaw: unknown = null;

    if (item.product_id && productMap.has(item.product_id)) {
      const p = productMap.get(item.product_id)!;
      name = p.name;
      demandGroup = p.demand_group_code;
      isBio = p.is_bio === true;
      isVegan = p.is_vegan === true;
      nutritionRaw = p.nutrition_info;
    } else if (item.competitor_product_id && competitorNames.has(item.competitor_product_id)) {
      name = competitorNames.get(item.competitor_product_id)!;
    }

    const key = pid ?? name;
    const existing = productFreq.get(key);
    const qty = item.quantity || 1;
    const price = item.total_price ?? 0;
    if (existing) {
      existing.count += qty;
      existing.spent += price;
    } else {
      productFreq.set(key, { name, count: qty, spent: price });
    }

    if (demandGroup) {
      const groupName = demandGroupNames.get(demandGroup) ?? demandGroup;
      const cat = categorySpend.get(groupName);
      if (cat) {
        cat.spent += price;
        cat.items += qty;
      } else {
        categorySpend.set(groupName, { spent: price, items: qty });
      }
    }

    totalProductItems += qty;
    if (isBio) bioCount += qty;
    if (isVegan) veganCount += qty;

    const parsed = parseNutritionSafe(nutritionRaw);
    if (parsed) {
      productsWithNutrition++;
      for (const [k, v] of Object.entries(parsed)) {
        if (!nutritionAccum[k]) nutritionAccum[k] = { sum: 0, count: 0 };
        nutritionAccum[k].sum += v;
        nutritionAccum[k].count++;
      }
    }
  }

  const topProducts = [...productFreq.values()]
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_TOP_PRODUCTS)
    .map((p) => ({ name: p.name, count: p.count, total_spent: Math.round(p.spent * 100) / 100 }));

  const categoryBreakdown = [...categorySpend.entries()]
    .sort((a, b) => b[1].spent - a[1].spent)
    .slice(0, MAX_CATEGORIES)
    .map(([group, v]) => ({ group, spent: Math.round(v.spent * 100) / 100, items: v.items }));

  let nutritionSummary: UserShoppingContext["nutrition_summary"];
  if (productsWithNutrition > 0) {
    const avg = (key: string) => {
      const a = nutritionAccum[key];
      return a && a.count > 0 ? Math.round((a.sum / a.count) * 10) / 10 : undefined;
    };
    nutritionSummary = {
      products_with_data: productsWithNutrition,
      products_total: totalProductItems,
      avg_energy_kcal: avg("energy_kcal"),
      avg_fat: avg("fat"),
      avg_carbs: avg("carbs"),
      avg_protein: avg("protein"),
      avg_sugar: avg("sugar"),
      avg_salt: avg("salt"),
    };
  }

  const weeklyMap = new Map<string, number>();
  for (const r of receipts) {
    if (!r.purchase_date) continue;
    const d = new Date(r.purchase_date);
    const weekStart = new Date(d);
    weekStart.setDate(d.getDate() - d.getDay() + 1);
    const weekKey = weekStart.toISOString().slice(0, 10);
    weeklyMap.set(weekKey, (weeklyMap.get(weekKey) ?? 0) + (r.total_amount ?? 0));
  }
  const weeklySpending = [...weeklyMap.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .slice(-MAX_WEEKLY_SPENDING)
    .map(([week, amount]) => ({ week, amount: Math.round(amount * 100) / 100 }));

  const organicRatio = totalProductItems > 0 ? Math.round((bioCount / totalProductItems) * 100) / 100 : 0;
  const veganRatio = totalProductItems > 0 ? Math.round((veganCount / totalProductItems) * 100) / 100 : 0;

  const autoReorderItems = autoReorder
    .slice(0, MAX_AUTO_REORDER)
    .map((a) => ({
      name: autoReorderNames.get(a.product_id) ?? a.product_id,
      interval: `${a.reorder_value} ${a.reorder_unit}`,
    }));

  return {
    receipt_count: receiptCount,
    date_range: dateRange,
    total_spent: Math.round(totalSpent * 100) / 100,
    avg_per_trip: Math.round(avgPerTrip * 100) / 100,
    shopping_frequency_per_week: Math.round(shoppingFreq * 10) / 10,
    top_products: topProducts,
    category_breakdown: categoryBreakdown,
    nutrition_summary: nutritionSummary,
    weekly_spending: weeklySpending,
    organic_ratio: organicRatio,
    vegan_ratio: veganRatio,
    auto_reorder_items: autoReorderItems,
    trip_count: trips.length,
  };
}
