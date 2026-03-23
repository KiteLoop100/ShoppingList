/**
 * Normalizes Claude cook-chat payloads before Zod validation.
 * The model sometimes returns recipe_detail ingredients as { item, amount: "750g", available }.
 */

/** Split a combined amount string like "750g" or "2 EL" into number + unit. */
export function parseAmountUnitString(s: string): { amount: number | null; unit: string | null } {
  const t = s.trim();
  if (!t) return { amount: null, unit: null };

  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*(.*)$/);
  if (m) {
    const num = Number.parseFloat(m[1].replace(",", "."));
    const rest = m[2].trim();
    if (!Number.isNaN(num)) {
      return { amount: num, unit: rest.length > 0 ? rest : null };
    }
  }
  return { amount: null, unit: null };
}

function pickIngredientName(o: Record<string, unknown>): string {
  if (typeof o.name === "string" && o.name.trim()) return o.name.trim();
  if (typeof o.item === "string" && o.item.trim()) return o.item.trim();
  if (typeof o.ingredient === "string" && o.ingredient.trim()) return o.ingredient.trim();
  return "";
}

/**
 * Normalizes one recipe ingredient to {@link RecipeIngredient} shape expected by the API schema.
 */
export function normalizeRecipeIngredient(ing: unknown): Record<string, unknown> {
  if (!ing || typeof ing !== "object") {
    return {
      name: "",
      amount: null,
      unit: null,
      category: "",
      notes: "",
      is_optional: false,
    };
  }
  const o = ing as Record<string, unknown>;
  const name = pickIngredientName(o);

  let amount: number | null = null;
  let unit: string | null = null;

  if (typeof o.amount === "number" && Number.isFinite(o.amount)) {
    amount = o.amount;
    unit = typeof o.unit === "string" ? o.unit : null;
  } else if (typeof o.amount === "string") {
    const p = parseAmountUnitString(o.amount);
    amount = p.amount;
    const unitFromField = typeof o.unit === "string" ? o.unit.trim() : "";
    unit = p.unit && p.unit.length > 0 ? p.unit : unitFromField.length > 0 ? unitFromField : null;
  } else if (o.amount === null || o.amount === undefined) {
    amount = null;
    unit = typeof o.unit === "string" ? o.unit : o.unit === null ? null : null;
  }

  const category = typeof o.category === "string" ? o.category : "";
  const notes = typeof o.notes === "string" ? o.notes : "";

  let is_optional = typeof o.is_optional === "boolean" ? o.is_optional : false;
  if (!("is_optional" in o) && "available" in o) {
    is_optional = false;
  }

  return {
    name,
    amount,
    unit,
    category,
    notes,
    is_optional,
  };
}

/**
 * Normalizes the `recipe` object inside a cook-chat JSON payload (ingredients shape).
 */
export function normalizeRecipeDetail(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const rec = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...rec };

  if (Array.isArray(rec.ingredients)) {
    out.ingredients = rec.ingredients.map((it) => normalizeRecipeIngredient(it));
  }

  return out;
}

/**
 * If the payload is `recipe_detail` with a `recipe` object, normalize ingredients before Zod.
 */
export function normalizeCookChatClaudePayload(raw: unknown): unknown {
  if (!raw || typeof raw !== "object") return raw;
  const top = raw as Record<string, unknown>;
  const out: Record<string, unknown> = { ...top };

  if (top.type === "recipe_detail" && top.recipe != null && typeof top.recipe === "object") {
    out.recipe = normalizeRecipeDetail(top.recipe);
  }

  return out;
}
