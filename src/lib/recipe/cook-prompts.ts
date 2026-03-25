/**
 * System prompts and context formatting for F-RECIPE-COOK (cook chat).
 * @see specs/F-RECIPE-FEATURES-SPEC.md — Sections 3.4, 6.3
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/types";
import type { InventoryItem } from "@/lib/inventory/inventory-types";
import type { CookChatMessage } from "@/lib/recipe/types";

/** Max catalog products injected into the cook prompt (token budget). */
export const MAX_CATALOG_PROMPT_PRODUCTS = 150;

/** Calendar days from today until best-before (0 = today); null if unknown. */
function daysUntilBestBefore(iso: string): number | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const now = new Date();
  const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const t1 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  return Math.round((t1 - t0) / 86_400_000);
}

function formatShortMhd(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${day}.${month}.`;
}

function statusShort(status: InventoryItem["status"]): string {
  if (status === "sealed") return "verschl.";
  if (status === "opened") return "offen";
  return status;
}

/**
 * Sort inventory: soonest best-before first; unknown dates last.
 */
export function sortInventoryForPrompt(items: InventoryItem[]): InventoryItem[] {
  return [...items].sort((a, b) => {
    if (!a.best_before && !b.best_before) return 0;
    if (!a.best_before) return 1;
    if (!b.best_before) return -1;
    return a.best_before.localeCompare(b.best_before);
  });
}

/**
 * Compact pantry lines for the model (German). MHD only if urgent (<7 days) or expired.
 */
export function formatPantryForPrompt(inventoryItems: InventoryItem[]): string {
  const sorted = sortInventoryForPrompt(inventoryItems);
  const lines = sorted.map((it) => {
    const st = statusShort(it.status);
    let line = `${it.display_name} ×${it.quantity} (${st}`;
    if (it.best_before) {
      const days = daysUntilBestBefore(it.best_before);
      if (days !== null && days < 7) {
        line += `, ⚠️ abl. ${formatShortMhd(it.best_before)}`;
      }
    }
    line += ")";
    return line;
  });
  return lines.length > 0 ? lines.join("\n") : "(leer)";
}

function formatPriceEUR(price: number | null): string {
  if (price == null || Number.isNaN(price)) return "—";
  return price.toFixed(2);
}

function categoryBucket(p: Product): string {
  return (p.demand_sub_group?.trim() || p.demand_group_code || "Sonstiges").slice(0, 80);
}

function productPriceToken(p: Product): string {
  return `${p.name} ${formatPriceEUR(p.price)}€`;
}

/**
 * ALDI catalog excerpt: popularity-ordered input, grouped by category, capped for token budget.
 */
export function formatCatalogForPrompt(products: Product[]): string {
  const slice = products.slice(0, MAX_CATALOG_PROMPT_PRODUCTS);
  const order: string[] = [];
  const byCat = new Map<string, Product[]>();
  for (const p of slice) {
    const key = categoryBucket(p);
    if (!byCat.has(key)) {
      byCat.set(key, []);
      order.push(key);
    }
    byCat.get(key)!.push(p);
  }
  const blocks = order.map((key) => {
    const items = byCat.get(key) ?? [];
    const body = items.map(productPriceToken).join(", ");
    return `${key.toUpperCase()}: ${body}`;
  });
  return blocks.length > 0 ? blocks.join("\n") : "(keine Produkte geladen)";
}

export function buildCookSystemPrompt(pantryFormatted: string, catalogFormatted: string): string {
  return `Kochassistent für eine ALDI-App: Rezepte passend zu Vorräten und Katalog.

## Vorräte
${pantryFormatted}

## ALDI-Katalog (Nachkauf; Zeilen = Kategorie: Produkt Preis€, …)
${catalogFormatted}

## Regeln
1. Nutze vorrangig Vorräte, minimiere Nachkauf; bald ablaufende zuerst
2. 2–3 Vorschläge oder ein volles Rezept / eine Rückfrage (max. eine Frage)
3. Pro Vorschlag: klar ✅ vorrätig / 🛒 fehlt
4. Deutsch, alltagstauglich; bei knappem Vorrat ehrlich sagen was geht
5. Auf Rezeptwunsch: volle Zutatenliste + Kochschritte

## JSON (ohne Markdown, ein Objekt)
{
  "type": "suggestions" | "clarification" | "recipe_detail",
  "message": "…",
  "suggestions": [ { "title": "…", "time_minutes": 25, "ingredients_available": [], "ingredients_missing": [], "all_available": false } ] | null,
  "question": string | null,
  "recipe": null | { "title", "servings", "time_minutes", "ingredients", "steps", "pantry_matches": [] }
}
- clarification: suggestions=null, question gesetzt
- suggestions: question=null, recipe=null
- recipe_detail: suggestions=null, recipe gesetzt

recipe.ingredients: je Zeile {"name","amount": Zahl|null,"unit": string|null,"category":"","notes":"","is_optional": bool}
Beispiel eine Zutat: {"name":"Spaghetti","amount":500,"unit":"g","category":"","notes":"","is_optional":false}
amount numerisch (z.B. 750), nie "750g" — Einheit in unit. steps = string[]. pantry_matches leeres Array.`;
}

/** Stricter follow-up if the first JSON parse fails. */
export const COOK_JSON_RETRY_USER =
  "Deine letzte Antwort war kein gültiges JSON. Antworte JETZT NUR mit einem einzigen JSON-Objekt (kein Markdown, kein Fließtext davor oder danach), exakt im im System-Prompt beschriebenen Schema.";

/**
 * Map stored assistant content (may be JSON of {@link AICookResponse}) to text for the model.
 */
export function cookMessageToClaudeText(msg: CookChatMessage): string {
  if (msg.role === "user") return msg.content;
  const t = msg.content.trim();
  if (t.startsWith("{")) {
    try {
      const p = JSON.parse(t) as { message?: string };
      if (typeof p.message === "string" && p.message.trim()) return p.message;
    } catch {
      /* use raw */
    }
  }
  return msg.content;
}

/**
 * Resolve DE/AT from default store country; falls back to DE.
 */
export async function resolveCatalogCountry(
  supabase: SupabaseClient,
  userId: string,
): Promise<"DE" | "AT"> {
  const { data: settings, error } = await supabase
    .from("user_settings")
    .select("default_store_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (error || !settings?.default_store_id) return "DE";

  const { data: store } = await supabase
    .from("stores")
    .select("country")
    .eq("store_id", settings.default_store_id)
    .maybeSingle();

  const c = store?.country?.toUpperCase();
  return c === "AT" ? "AT" : "DE";
}
