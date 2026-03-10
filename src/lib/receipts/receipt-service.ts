import type { SupabaseClient } from "@supabase/supabase-js";
import { log } from "@/lib/utils/logger";

export interface ReceiptData {
  receipt_id: string;
  store_name: string | null;
  store_address: string | null;
  retailer: string | null;
  purchase_date: string | null;
  purchase_time: string | null;
  total_amount: number | null;
  payment_method: string | null;
  items_count: number;
  photo_urls: string[];
}

export interface ReceiptItem {
  receipt_item_id: string;
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
  product_name?: string | null;
  thumbnail_url?: string | null;
}

export interface GroupedReceiptItem extends ReceiptItem {
  grouped_count: number;
  original_positions: number[];
  original_item_ids: string[];
}

export interface ReceiptWithItems {
  receipt: ReceiptData;
  items: ReceiptItem[];
  photoUrls: string[];
}

function getGroupKey(item: ReceiptItem): string {
  if (item.product_id) return `pid:${item.product_id}`;
  if (item.competitor_product_id) return `cpid:${item.competitor_product_id}`;
  return `name:${item.receipt_name.trim().toLowerCase()}`;
}

function itemPrice(item: ReceiptItem): number {
  if (item.total_price != null) return item.total_price;
  if (item.unit_price != null) return item.unit_price * item.quantity;
  return 0;
}

export function groupReceiptItems(items: ReceiptItem[]): GroupedReceiptItem[] {
  const groups = new Map<string, ReceiptItem[]>();
  const order: string[] = [];

  for (const item of items) {
    const key = getGroupKey(item);
    const bucket = groups.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      groups.set(key, [item]);
      order.push(key);
    }
  }

  return order.map((key) => {
    const bucket = groups.get(key)!;
    if (bucket.length === 1) {
      const solo = bucket[0];
      return {
        ...solo,
        grouped_count: 1,
        original_positions: [solo.position],
        original_item_ids: [solo.receipt_item_id],
      };
    }

    const first = bucket[0];
    const totalQty = bucket.reduce((s, i) => s + i.quantity, 0);
    const totalPriceSum = bucket.reduce((s, i) => s + itemPrice(i), 0);
    const totalWeight = first.is_weight_item
      ? bucket.reduce((s, i) => s + (i.weight_kg ?? 0), 0)
      : first.weight_kg;

    const linked = bucket.find((i) => i.product_name || i.thumbnail_url) ?? first;

    return {
      ...first,
      receipt_item_id: first.receipt_item_id,
      position: Math.min(...bucket.map((i) => i.position)),
      quantity: totalQty,
      total_price: totalPriceSum,
      unit_price: totalQty > 0 ? totalPriceSum / totalQty : first.unit_price,
      weight_kg: totalWeight,
      product_name: linked.product_name ?? first.product_name,
      thumbnail_url: linked.thumbnail_url ?? first.thumbnail_url,
      article_number: linked.article_number ?? first.article_number,
      grouped_count: bucket.length,
      original_positions: bucket.map((i) => i.position),
      original_item_ids: bucket.map((i) => i.receipt_item_id),
    };
  });
}

export async function loadReceiptWithItems(
  receiptId: string,
  supabase: SupabaseClient
): Promise<ReceiptWithItems | null> {
  const [receiptRes, itemsRes] = await Promise.all([
    supabase
      .from("receipts")
      .select(
        "receipt_id, store_name, store_address, retailer, purchase_date, purchase_time, total_amount, payment_method, items_count, photo_urls"
      )
      .eq("receipt_id", receiptId)
      .single(),
    supabase
      .from("receipt_items")
      .select(
        "receipt_item_id, position, article_number, receipt_name, product_id, competitor_product_id, quantity, unit_price, total_price, is_weight_item, weight_kg"
      )
      .eq("receipt_id", receiptId)
      .order("position", { ascending: true }),
  ]);

  if (!receiptRes.data) {
    console.warn("[receipts] Failed to load receipt:", receiptRes.error);
    return null;
  }

  const receipt = receiptRes.data as ReceiptData;
  const photoUrls = await getSignedPhotoUrls(receipt.photo_urls ?? [], supabase);

  if (itemsRes.error) {
    console.warn("[receipts] Failed to load receipt items:", itemsRes.error);
  }

  let items: ReceiptItem[] = [];
  if (itemsRes.data) {
    const aldiProductIds = itemsRes.data
      .filter((i) => i.product_id)
      .map((i) => i.product_id as string);

    const competitorProductIds = itemsRes.data
      .filter((i) => i.competitor_product_id)
      .map((i) => i.competitor_product_id as string);

    let productInfo: Record<string, { name: string; thumbnail_url: string | null }> = {};

    if (aldiProductIds.length > 0) {
      const { data: products } = await supabase
        .from("products")
        .select("product_id, name, thumbnail_url")
        .in("product_id", aldiProductIds);

      if (products) {
        for (const p of products) {
          productInfo[p.product_id] = { name: p.name, thumbnail_url: p.thumbnail_url };
        }
      }
    }

    if (competitorProductIds.length > 0) {
      const { data: cProducts } = await supabase
        .from("competitor_products")
        .select("product_id, name, thumbnail_url")
        .in("product_id", competitorProductIds);

      if (cProducts) {
        for (const p of cProducts) {
          productInfo[p.product_id] = { name: p.name, thumbnail_url: p.thumbnail_url };
        }
      }
    }

    items = itemsRes.data.map((item) => {
      const linkedId = item.product_id || item.competitor_product_id;
      const info = linkedId ? productInfo[linkedId] : null;
      return {
        ...item,
        competitor_product_id: item.competitor_product_id ?? null,
        product_name: info?.name ?? null,
        thumbnail_url: info?.thumbnail_url ?? null,
      };
    });
  }

  return { receipt, items, photoUrls };
}

export async function linkReceiptItemToProduct(
  receiptItemIds: string | string[],
  productId: string,
  supabase: SupabaseClient,
  productType: "aldi" | "competitor" = "aldi",
): Promise<void> {
  const ids = Array.isArray(receiptItemIds) ? receiptItemIds : [receiptItemIds];
  const setColumn = productType === "competitor" ? "competitor_product_id" : "product_id";
  const clearColumn = productType === "competitor" ? "product_id" : "competitor_product_id";
  const { error } = await supabase
    .from("receipt_items")
    .update({ [setColumn]: productId, [clearColumn]: null })
    .in("receipt_item_id", ids);

  if (error) {
    log.warn("[receipts] Failed to link receipt item(s) to product:", error);
    throw error;
  }
}

export async function getSignedPhotoUrls(
  photoUrls: string[],
  supabase: SupabaseClient
): Promise<string[]> {
  if (photoUrls.length === 0) return [];

  const isStoragePath = (v: string) => !v.startsWith("http");
  const pathUrls = photoUrls.filter(isStoragePath);

  if (pathUrls.length === 0) return photoUrls;

  const { data: signedData } = await supabase.storage
    .from("receipt-photos")
    .createSignedUrls(pathUrls, 300);

  const signedMap = new Map(
    (signedData ?? []).map((s) => [s.path, s.signedUrl])
  );

  return photoUrls
    .map((u) => (isStoragePath(u) ? signedMap.get(u) ?? "" : u))
    .filter(Boolean);
}
