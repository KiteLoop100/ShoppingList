import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";

export interface AutoReorderSetting {
  id: string;
  user_id: string;
  product_id: string;
  reorder_value: number;
  reorder_unit: "days" | "weeks" | "months";
  last_checked_at: string | null;
  is_active: boolean;
}

/**
 * Fetch active auto-reorder settings for the current user.
 * Returns null when Supabase is not configured.
 */
export async function fetchActiveAutoReorderSettings(): Promise<AutoReorderSetting[] | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;
  const userId = getCurrentUserId();

  const { data } = await supabase
    .from("auto_reorder_settings")
    .select("id, user_id, product_id, reorder_value, reorder_unit, last_checked_at, is_active")
    .eq("user_id", userId)
    .eq("is_active", true);

  return (data as AutoReorderSetting[] | null) ?? null;
}

/**
 * When a list item is checked off, update `last_checked_at` on its
 * auto-reorder setting (if one exists). Looks up the product_id from the
 * list_items table, then patches auto_reorder_settings.
 */
export async function touchAutoReorderOnCheckoff(
  itemId: string,
  nowIso: string,
): Promise<string | null> {
  const supabase = createClientIfConfigured();
  if (!supabase) return null;
  const userId = getCurrentUserId();

  const { data: listItem } = await supabase
    .from("list_items")
    .select("product_id")
    .eq("item_id", itemId)
    .maybeSingle();

  if (!listItem?.product_id) return null;

  await supabase
    .from("auto_reorder_settings")
    .update({ last_checked_at: nowIso })
    .eq("user_id", userId)
    .eq("product_id", listItem.product_id)
    .eq("is_active", true);

  return listItem.product_id as string;
}
