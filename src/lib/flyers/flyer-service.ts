import { createClientIfConfigured } from "@/lib/supabase/client";

export interface FlyerRow {
  flyer_id: string;
  title: string;
  valid_from: string;
  valid_until: string;
}

export interface FlyerPageRow {
  page_id: string;
  page_number: number;
  image_url: string | null;
}

export interface BBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface ProductRow {
  product_id: string;
  name: string;
  price: number | null;
  price_in_flyer: number | null;
  demand_group_code: string;
  flyer_page: number | null;
  bbox: BBox | null;
}

export type FlyerLoadResult =
  | { flyer: FlyerRow; pages: FlyerPageRow[]; productsByPage: Map<number, ProductRow[]> }
  | { error: string };

interface FlyerPageProductJoin {
  page_number: number;
  price_in_flyer: number | null;
  bbox: BBox | null;
  products: {
    product_id: string;
    name: string;
    price: number | null;
    demand_group_code: string;
  };
}

function mapJoinToProducts(rows: FlyerPageProductJoin[]): ProductRow[] {
  return rows.map((r) => ({
    product_id: r.products.product_id,
    name: r.products.name,
    price: r.products.price,
    price_in_flyer: r.price_in_flyer,
    demand_group_code: r.products.demand_group_code,
    flyer_page: r.page_number,
    bbox: r.bbox,
  }));
}

export function groupFlyerProducts(products: ProductRow[]): Map<number, ProductRow[]> {
  const byPage = new Map<number, ProductRow[]>();
  for (const p of products) {
    const pageNum = p.flyer_page ?? 0;
    if (pageNum >= 1) {
      const existing = byPage.get(pageNum) ?? [];
      existing.push(p);
      byPage.set(pageNum, existing);
    }
  }
  return byPage;
}

export async function loadFlyerWithPages(flyerId: string): Promise<FlyerLoadResult> {
  const supabase = createClientIfConfigured();
  if (!supabase) return { error: "notFound" };

  const { data: flyerData, error: flyerErr } = await supabase
    .from("flyers")
    .select("flyer_id, title, valid_from, valid_until")
    .eq("flyer_id", flyerId)
    .single();

  if (flyerErr || !flyerData) return { error: "notFound" };

  const { data: pagesData, error: pagesErr } = await supabase
    .from("flyer_pages")
    .select("page_id, page_number, image_url")
    .eq("flyer_id", flyerId)
    .order("page_number", { ascending: true });

  if (pagesErr) return { error: "notFound" };

  const { data: fppData } = await supabase
    .from("flyer_page_products")
    .select("page_number, price_in_flyer, bbox, products!inner(product_id, name, price, demand_group_code)")
    .eq("flyer_id", flyerId);

  const products = mapJoinToProducts((fppData ?? []) as unknown as FlyerPageProductJoin[]);

  return {
    flyer: flyerData,
    pages: pagesData ?? [],
    productsByPage: groupFlyerProducts(products),
  };
}

export async function fetchFlyerProducts(flyerId: string): Promise<Map<number, ProductRow[]>> {
  const supabase = createClientIfConfigured();
  if (!supabase) return new Map();

  const { data: fppData } = await supabase
    .from("flyer_page_products")
    .select("page_number, price_in_flyer, bbox, products!inner(product_id, name, price, demand_group_code)")
    .eq("flyer_id", flyerId);

  const products = mapJoinToProducts((fppData ?? []) as unknown as FlyerPageProductJoin[]);
  return groupFlyerProducts(products);
}
