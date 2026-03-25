/**
 * System prompts and context formatting for F-RECIPE-COOK (cook chat).
 * @see specs/F-RECIPE-FEATURES-SPEC.md — Sections 3.4, 6.3
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Product } from "@/types";
import type { InventoryItem } from "@/lib/inventory/inventory-types";
import type { CookChatMessage } from "@/lib/recipe/types";

/** Max catalog lines injected into the cook prompt (token budget). */
export const MAX_CATALOG_PROMPT_PRODUCTS = 200;

const DE_DATE = new Intl.DateTimeFormat("de-DE", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function formatBestBefore(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return DE_DATE.format(d);
}

function statusLabel(status: InventoryItem["status"]): string {
  if (status === "sealed") return "verschlossen";
  if (status === "opened") return "geöffnet";
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
 * One line per pantry item for the model (German labels).
 */
export function formatPantryForPrompt(inventoryItems: InventoryItem[]): string {
  const sorted = sortInventoryForPrompt(inventoryItems);
  const lines = sorted.map((it) => {
    const status = statusLabel(it.status);
    let line = `- ${it.display_name}, ${it.quantity} Stk, Status: ${status}`;
    const mhd = formatBestBefore(it.best_before);
    if (mhd) {
      line += `, ablaufend am ${mhd}`;
    }
    return line;
  });
  return lines.length > 0 ? lines.join("\n") : "(leer)";
}

function formatPriceEUR(price: number | null): string {
  if (price == null || Number.isNaN(price)) return "—";
  return price.toFixed(2);
}

function categoryLabel(p: Product): string {
  return (p.demand_sub_group?.trim() || p.demand_group_code || "—").slice(0, 80);
}

/**
 * Compact ALDI catalog excerpt: popularity-ordered input, capped for token budget.
 */
export function formatCatalogForPrompt(products: Product[]): string {
  const slice = products.slice(0, MAX_CATALOG_PROMPT_PRODUCTS);
  const lines = slice.map((p) => {
    const cat = categoryLabel(p);
    const eur = formatPriceEUR(p.price);
    return `${p.name} (${cat}, ${eur}€)`;
  });
  return lines.length > 0 ? lines.join("\n") : "(keine Produkte geladen)";
}

export function buildCookSystemPrompt(pantryFormatted: string, catalogFormatted: string): string {
  return `Du bist ein hilfreicher Kochassistent in einer ALDI-Einkaufs-App. Der Nutzer möchte Rezeptvorschläge basierend auf seinen Vorräten.

## Vorräte des Nutzers
${pantryFormatted}

## ALDI-Produktkatalog (verfügbar zum Nachkauf)
${catalogFormatted}

## Regeln
1. Bevorzuge Rezepte, die HAUPTSÄCHLICH vorrätige Zutaten nutzen (minimiere Nachkäufe)
2. Schlage 2-3 Rezepte pro Antwort vor
3. Markiere für jedes Rezept klar, welche Zutaten vorrätig (✅) und welche nachgekauft werden müssen (🛒)
4. Berücksichtige Haltbarkeit: Produkte die bald ablaufen zuerst verwenden
5. Bei vager Anfrage: stelle MAXIMAL EINE Rückfrage
6. Antworte auf Deutsch
7. Halte Rezepte alltagstauglich — keine Restaurant-Gerichte
8. Bei sehr begrenztem Vorrat: sage ehrlich, was möglich ist und was mit 1-2 Nachkäufen machbar wäre
9. Wenn der Nutzer ein Rezept auswählt, liefere vollständige Kochschritte

## Antwortformat
Antworte IMMER in diesem JSON-Format, ohne Markdown-Backticks:
{
  "type": "suggestions" | "clarification" | "recipe_detail",
  "message": "Natürlichsprachige Einleitung",
  "suggestions": [
    {
      "title": "Rezeptname",
      "time_minutes": 25,
      "ingredients_available": ["Spaghetti", "Knoblauch"],
      "ingredients_missing": ["Sahne"],
      "all_available": false
    }
  ],
  "question": null,
  "recipe": null
}

Bei type 'clarification': suggestions=null, question='Deine Rückfrage'
Bei type 'recipe_detail': suggestions=null, recipe={...vollständiges Rezept}
Bei type 'suggestions': question=null, recipe=null

Bei type 'recipe_detail' MUSS recipe exakt dieses Schema einhalten (Beispiel):
recipe = {
  "title": "Rezeptname",
  "servings": 4,
  "time_minutes": 30,
  "ingredients": [
    {"name": "Spaghetti", "amount": 500, "unit": "g", "category": "", "notes": "", "is_optional": false},
    {"name": "Olivenöl", "amount": 2, "unit": "EL", "category": "", "notes": "", "is_optional": false},
    {"name": "Salz", "amount": null, "unit": null, "category": "", "notes": "nach Geschmack", "is_optional": true}
  ],
  "steps": ["Schritt 1 …", "Schritt 2 …"],
  "pantry_matches": []
}
WICHTIG: Jede Zutat braucht die Felder name, amount (Zahl oder null), unit (String oder null), category (String, leer erlaubt), notes (String), is_optional (boolean).
amount ist IMMER eine Zahl (z.B. 750), NICHT ein String wie "750g" — Einheit immer in unit.`;
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
