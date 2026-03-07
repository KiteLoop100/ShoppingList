import type { SupabaseClient } from "@supabase/supabase-js";

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

export interface ReceiptWithItems {
  receipt: ReceiptData;
  items: ReceiptItem[];
  photoUrls: string[];
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
  receiptItemId: string,
  productId: string,
  supabase: SupabaseClient,
): Promise<void> {
  const { error } = await supabase
    .from("receipt_items")
    .update({ product_id: productId })
    .eq("receipt_item_id", receiptItemId);

  if (error) {
    console.warn("[receipts] Failed to link receipt item to product:", error);
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
