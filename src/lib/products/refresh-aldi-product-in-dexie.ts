import { db } from "@/lib/db";
import { log } from "@/lib/utils/logger";
import type { Product } from "@/types";
import { fetchAldiProductByIdFromSupabase } from "./fetch-aldi-product";

/** Fetches one ALDI product from Supabase and overwrites the Dexie row (e.g. after gallery edits). */
export async function refreshAldiProductInDexie(productId: string): Promise<Product | null> {
  const fresh = await fetchAldiProductByIdFromSupabase(productId);
  if (!fresh) return null;
  try {
    await db.products.put(fresh);
  } catch (e) {
    log.warn("[products] IndexedDB put after gallery change failed:", e);
  }
  return fresh;
}
