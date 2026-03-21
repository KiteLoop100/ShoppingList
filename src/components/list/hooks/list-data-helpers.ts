import { setDemandGroups } from "@/lib/search/local-search";
import { db } from "@/lib/db";
import { getActiveListWithItems } from "@/lib/list";
import { type ProductMetaForSort, type ListItemWithMeta } from "@/lib/list/list-helpers";
import { getStoreById } from "@/lib/store/store-service";
import {
  fetchDemandGroupsFromSupabase,
  fetchDemandSubGroupsFromSupabase,
  toDemandGroups,
} from "@/lib/categories/category-service";
import {
  fetchActiveAutoReorderSettings,
  type AutoReorderSetting,
} from "@/lib/list/auto-reorder-service";
import type { LocalDemandGroup, LocalDemandSubGroup, LocalListItem, LocalShoppingList, LocalStore } from "@/lib/db";
import type { DemandGroup, DemandSubGroup, Product } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────

const COUNTRY_TZ: Record<string, string> = {
  DE: "Europe/Berlin",
  AT: "Europe/Vienna",
  NZ: "Pacific/Auckland",
};

// ─── Shared types ─────────────────────────────────────────────────────

export interface ListDataCaches {
  demandGroupsCache: { current: DemandGroup[] | null };
  demandSubGroupsCache: { current: DemandSubGroup[] | null };
  autoReorderCache: { current: AutoReorderSetting[] | null };
  idbProductsCache: { current: Product[] | null };
}

export interface FetchedListData {
  list: LocalShoppingList;
  items: LocalListItem[];
  idbProducts: Product[];
  demandGroups: DemandGroup[];
  demandGroupMap: Map<string, DemandGroup>;
  reorderMap: Map<string, AutoReorderSetting>;
  storeResult: LocalStore | null;
}

export interface ProductMaps {
  productPriceMap: Map<string, number>;
  productThumbnailMap: Map<string, string>;
  productMetaMap: Map<string, ProductMetaForSort>;
  productIdsWithAdditionalInfo: Set<string>;
  productDeferredInfo: Map<string, { assortment_type: string; special_start_date: string | null; country: string }>;
}

export interface SortData {
  items: LocalListItem[];
  effectiveStoreId: string | null;
  demandGroups: DemandGroup[];
  demandGroupMap: Map<string, DemandGroup>;
  productMetaMap: Map<string, ProductMetaForSort>;
  productPriceMap: Map<string, number>;
  productThumbnailMap: Map<string, string>;
  productIdsWithAdditionalInfo: Set<string>;
  productDeferredInfo: Map<string, { assortment_type: string; special_start_date: string | null; country: string }>;
}

export interface SortedItems {
  unchecked: ListItemWithMeta[];
  checked: ListItemWithMeta[];
  deferred: ListItemWithMeta[];
}

// ─── Pure helper functions ────────────────────────────────────────────

export function computeActivationTime(specialStartDate: string, country: string): number {
  const tz = COUNTRY_TZ[country] || "Europe/Berlin";
  const [y, m, d] = specialStartDate.split("-").map(Number);
  const dayBefore = new Date(Date.UTC(y, m - 1, d));
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);

  const guessUtc = Date.UTC(
    dayBefore.getUTCFullYear(), dayBefore.getUTCMonth(), dayBefore.getUTCDate(),
    14, 0, 0
  );
  const localHourStr = new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hour: "numeric", hour12: false,
  }).format(new Date(guessUtc));
  const localHour = parseInt(localHourStr, 10);
  return guessUtc - (localHour - 15) * 3_600_000;
}

export async function fetchListData(caches: ListDataCaches): Promise<FetchedListData> {
  const shouldFetchDemandGroups = caches.demandGroupsCache.current === null;
  const shouldFetchSubGroups = caches.demandSubGroupsCache.current === null;
  const shouldFetchReorder = caches.autoReorderCache.current === null;
  const shouldFetchIdbProducts = caches.idbProductsCache.current === null;

  const [listResult, idbProductsResult, reorderRows, idbDgs, dgRows, idbDsgs, dsgRows] = await Promise.all([
    getActiveListWithItems(),
    shouldFetchIdbProducts ? db.products.toArray() : Promise.resolve([] as Product[]),
    shouldFetchReorder ? fetchActiveAutoReorderSettings() : Promise.resolve(null),
    shouldFetchDemandGroups ? db.demand_groups.toArray() : Promise.resolve([] as LocalDemandGroup[]),
    shouldFetchDemandGroups ? fetchDemandGroupsFromSupabase() : Promise.resolve(null),
    shouldFetchSubGroups ? db.demand_sub_groups.toArray().catch(() => [] as LocalDemandSubGroup[]) : Promise.resolve([] as LocalDemandSubGroup[]),
    shouldFetchSubGroups ? fetchDemandSubGroupsFromSupabase() : Promise.resolve(null),
  ]);

  const { list, items } = listResult;

  const idbProducts = caches.idbProductsCache.current ?? idbProductsResult;
  if (caches.idbProductsCache.current === null) {
    caches.idbProductsCache.current = idbProducts;
  }

  const storeResult = list.store_id != null ? await getStoreById(list.store_id) : null;

  let demandGroups: DemandGroup[];
  if (caches.demandGroupsCache.current) {
    demandGroups = caches.demandGroupsCache.current;
  } else {
    demandGroups = idbDgs.map(dg => ({ code: dg.code, name: dg.name, name_en: dg.name_en, icon: dg.icon, color: dg.color, sort_position: dg.sort_position }));
    if (dgRows?.length) {
      const codeSet = new Set(demandGroups.map(dg => dg.code));
      for (const row of toDemandGroups(dgRows)) {
        if (!codeSet.has(row.code)) {
          codeSet.add(row.code);
          demandGroups.push(row);
        }
      }
    }
    caches.demandGroupsCache.current = demandGroups;
    setDemandGroups(demandGroups);
  }

  if (caches.demandSubGroupsCache.current === null) {
    const subGroups: DemandSubGroup[] = idbDsgs.map(sg => ({
      code: sg.code, name: sg.name, name_en: sg.name_en, demand_group_code: sg.demand_group_code, sort_position: sg.sort_position,
    }));
    if (dsgRows?.length) {
      const codeSet = new Set(subGroups.map(sg => sg.code));
      for (const row of dsgRows) {
        if (!codeSet.has(row.code)) {
          codeSet.add(row.code);
          subGroups.push({ code: row.code, name: row.name, name_en: row.name_en, demand_group_code: row.demand_group_code, sort_position: row.sort_position });
        }
      }
    }
    caches.demandSubGroupsCache.current = subGroups;
  }

  if (caches.autoReorderCache.current === null) {
    caches.autoReorderCache.current = ((reorderRows ?? []) as AutoReorderSetting[]).map(row => ({
      ...row,
      product_id: String(row.product_id),
    }));
  }

  const demandGroupMap = new Map(demandGroups.map(dg => [dg.code, dg]));
  const reorderMap = new Map<string, AutoReorderSetting>();
  for (const row of caches.autoReorderCache.current) {
    reorderMap.set(row.product_id, row);
  }
  return { list, items, idbProducts, demandGroups, demandGroupMap, reorderMap, storeResult };
}

export function buildProductMaps(idbProducts: Product[], contextProducts: Product[]): ProductMaps {
  const productPriceMap = new Map<string, number>();
  const productThumbnailMap = new Map<string, string>();
  const productMetaMap = new Map<string, ProductMetaForSort>();
  const productIdsWithAdditionalInfo = new Set<string>();
  const productDeferredInfo = new Map<string, { assortment_type: string; special_start_date: string | null; country: string }>();

  const SPECIAL_TYPES = new Set(["special", "special_food", "special_nonfood"]);

  const markHasAdditionalInfo = (p: Pick<Product, "product_id" | "thumbnail_url" | "brand" | "nutrition_info" | "ingredients" | "allergens" | "weight_or_quantity" | "article_number" | "ean_barcode" | "demand_group_code" | "assortment_type" | "special_start_date" | "special_end_date">) => {
    if (p.thumbnail_url || (p.brand != null && p.brand !== "") || (p.nutrition_info != null && typeof p.nutrition_info === "object" && Object.keys(p.nutrition_info).length > 0) || (p.ingredients != null && p.ingredients !== "") || (p.allergens != null && p.allergens !== "") || (p.weight_or_quantity != null && p.weight_or_quantity !== "") || (p.article_number != null && p.article_number !== "") || (p.ean_barcode != null && p.ean_barcode !== "") || (p.demand_group_code != null && p.demand_group_code !== "") || (p.assortment_type === "special" || p.assortment_type === "special_food" || p.assortment_type === "special_nonfood") || (p.special_start_date != null && p.special_start_date !== "") || (p.special_end_date != null && p.special_end_date !== "")) {
      productIdsWithAdditionalInfo.add(p.product_id);
    }
  };

  /** IDB first, then context. Context wins for thumbnails: if server/product context has no URL, clear stale IDB thumb. */
  const processProduct = (p: Product, source: "idb" | "context") => {
    if (p.price != null) productPriceMap.set(p.product_id, p.price);
    if (p.thumbnail_url) {
      productThumbnailMap.set(p.product_id, p.thumbnail_url);
    } else if (source === "context") {
      productThumbnailMap.delete(p.product_id);
    }
    markHasAdditionalInfo(p);
    productMetaMap.set(p.product_id, {
      demand_group_code: p.demand_group_code ?? null,
      demand_sub_group: p.demand_sub_group ?? null,
      popularity_score: p.popularity_score ?? null,
      is_special: SPECIAL_TYPES.has(p.assortment_type ?? ""),
    });
    productDeferredInfo.set(p.product_id, {
      assortment_type: p.assortment_type ?? "daily_range",
      special_start_date: p.special_start_date ?? null,
      country: p.country ?? "DE",
    });
  };

  for (const p of idbProducts) processProduct(p, "idb");
  for (const p of contextProducts) processProduct(p, "context");

  return { productPriceMap, productThumbnailMap, productMetaMap, productIdsWithAdditionalInfo, productDeferredInfo };
}

export function scheduleActivationTimer(
  deferredItems: ListItemWithMeta[],
  productDeferredInfo: Map<string, { assortment_type: string; special_start_date: string | null; country: string }>,
  refetchFn: () => void,
  timerRef: { current: ReturnType<typeof setTimeout> | null },
): void {
  if (timerRef.current) {
    clearTimeout(timerRef.current);
    timerRef.current = null;
  }
  if (deferredItems.length === 0) return;

  let nearestMs = Infinity;
  for (const item of deferredItems) {
    if (!item.product_id) continue;
    if (item.deferred_reason === "special") {
      const info = productDeferredInfo.get(item.product_id);
      if (info?.special_start_date) {
        const actMs = computeActivationTime(info.special_start_date, info.country);
        const delta = actMs - Date.now();
        if (delta > 0 && delta < nearestMs) nearestMs = delta;
      }
    } else if (item.deferred_reason === "reorder" && item.available_from) {
      const actMs = new Date(item.available_from + "T00:00:00").getTime();
      const delta = actMs - Date.now();
      if (delta > 0 && delta < nearestMs) nearestMs = delta;
    }
  }
  if (nearestMs < Infinity) {
    timerRef.current = setTimeout(refetchFn, Math.min(nearestMs + 1000, 2_147_483_647));
  }
}
