/**
 * Server-side recipe extraction: JSON-LD → Microdata → Claude fallback.
 * @see specs/F-RECIPE-FEATURES-SPEC.md — Sections 2.2, 6.1
 */

import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { parseIngredientString } from "@/lib/recipe/ingredient-parser";
import type { ExtractedRecipe, RecipeIngredient } from "@/lib/recipe/types";
import { log } from "@/lib/utils/logger";

const RECIPE_EXTRACT_SYSTEM = `Du extrahierst Rezeptdaten aus Webseitentext. Antworte NUR mit validem JSON im folgenden Format, ohne Markdown-Backticks oder Erklärungen:
{
  "title": "...",
  "servings": 4,
  "servings_label": "Portionen",
  "ingredients": [
    {"name": "...", "amount": 400, "unit": "g", "notes": "", "is_optional": false}
  ],
  "prep_time_minutes": 15,
  "cook_time_minutes": 20,
  "difficulty": "normal"
}
Falls du keine Rezeptdaten findest, antworte mit: {"error": "no_recipe_found"}`;

export function parseIso8601DurationToMinutes(iso: string | undefined | null): number | null {
  if (!iso || typeof iso !== "string" || !iso.startsWith("P")) return null;
  let total = 0;
  const h = iso.match(/(\d+)H/i);
  const m = iso.match(/(\d+)M/i);
  const d = iso.match(/(\d+)D/i);
  const s = iso.match(/(\d+)S/i);
  if (d) total += parseInt(d[1], 10) * 24 * 60;
  if (h) total += parseInt(h[1], 10) * 60;
  if (m) total += parseInt(m[1], 10);
  if (s) total += Math.round(parseInt(s[1], 10) / 60);
  return total > 0 ? total : null;
}

export function parseServingsFromYield(yieldVal: unknown): {
  servings: number;
  label: string;
} {
  if (typeof yieldVal === "number" && Number.isFinite(yieldVal)) {
    return { servings: Math.max(1, Math.round(yieldVal)), label: "Portionen" };
  }
  if (Array.isArray(yieldVal) && yieldVal.length > 0) {
    return parseServingsFromYield(yieldVal[0]);
  }
  if (typeof yieldVal === "string") {
    const m = yieldVal.match(/(\d+(?:[.,]\d+)?)/);
    const n = m ? parseFloat(m[1].replace(",", ".")) : 4;
    const label = yieldVal.replace(/[\d.,\s]+/g, " ").trim() || "Portionen";
    return {
      servings: Math.max(1, Math.round(Number.isFinite(n) ? n : 4)),
      label: label || "Portionen",
    };
  }
  return { servings: 4, label: "Portionen" };
}

function isRecipeType(t: unknown): boolean {
  if (t === "Recipe") return true;
  if (Array.isArray(t)) return t.some((x) => x === "Recipe");
  return false;
}

function findRecipeNode(obj: unknown): Record<string, unknown> | null {
  if (obj == null) return null;
  if (Array.isArray(obj)) {
    for (const el of obj) {
      const r = findRecipeNode(el);
      if (r) return r;
    }
    return null;
  }
  if (typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (isRecipeType(o["@type"])) return o;
  if (o["@graph"]) return findRecipeNode(o["@graph"]);
  for (const v of Object.values(o)) {
    if (typeof v === "object" && v !== null) {
      const r = findRecipeNode(v);
      if (r) return r;
    }
  }
  return null;
}

function toIngredientLines(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === "string") return [raw];
  if (Array.isArray(raw)) {
    return raw.flatMap((x) => {
      if (typeof x === "string") return [x];
      if (x && typeof x === "object") {
        const o = x as Record<string, unknown>;
        if (typeof o.text === "string") return [o.text];
        if (typeof o.name === "string") return [o.name];
      }
      return [];
    });
  }
  return [];
}

function mapDifficulty(d: unknown): ExtractedRecipe["difficulty"] {
  if (d == null || d === "") return null;
  const s = String(d).toLowerCase();
  if (["einfach", "easy", "leicht"].includes(s)) return "einfach";
  if (["anspruchsvoll", "hard", "schwer"].includes(s)) return "anspruchsvoll";
  if (["normal", "medium", "mittel"].includes(s)) return "normal";
  return null;
}

function buildExtractedRecipe(params: {
  title: string;
  ingredientLines: string[];
  recipeYield?: unknown;
  prepTime?: unknown;
  cookTime?: unknown;
  difficulty?: unknown;
}): ExtractedRecipe | null {
  const title = params.title.trim();
  if (!title) return null;
  const lines = params.ingredientLines.map((s) => s.trim()).filter(Boolean);
  if (lines.length === 0) return null;

  const { servings, label } = parseServingsFromYield(params.recipeYield ?? undefined);

  const prep =
    typeof params.prepTime === "string"
      ? parseIso8601DurationToMinutes(params.prepTime)
      : null;
  const cook =
    typeof params.cookTime === "string"
      ? parseIso8601DurationToMinutes(params.cookTime)
      : null;

  const ingredients = lines.map((line) => parseIngredientString(line));

  return {
    title,
    servings,
    servings_label: label,
    ingredients,
    source_url: null,
    source_name: "",
    prep_time_minutes: prep,
    cook_time_minutes: cook,
    difficulty: mapDifficulty(params.difficulty),
  };
}

function collectItempropValues(html: string, prop: string): string[] {
  const out: string[] = [];
  const contentRe = new RegExp(
    `itemprop=["']${prop}["'][^>]*content=["']([^"']*)["']`,
    "gi",
  );
  for (const x of html.matchAll(contentRe)) {
    if (x[1]?.trim()) out.push(x[1].trim());
  }
  const innerRe = new RegExp(`itemprop=["']${prop}["'][^>]*>([^<]+)<`, "gi");
  for (const x of html.matchAll(innerRe)) {
    if (x[1]?.trim()) out.push(x[1].trim());
  }
  return out;
}

export function extractFromJsonLd(html: string): ExtractedRecipe | null {
  const scriptRe =
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  for (const m of html.matchAll(scriptRe)) {
    const raw = m[1]?.trim();
    if (!raw) continue;
    try {
      const parsed: unknown = JSON.parse(raw);
      const recipeObj = findRecipeNode(parsed);
      if (!recipeObj) continue;

      const title =
        (typeof recipeObj.name === "string" && recipeObj.name) ||
        (typeof recipeObj.headline === "string" && recipeObj.headline) ||
        "";

      const lines = toIngredientLines(recipeObj.recipeIngredient);

      const result = buildExtractedRecipe({
        title,
        ingredientLines: lines,
        recipeYield: recipeObj.recipeYield,
        prepTime: recipeObj.prepTime,
        cookTime: recipeObj.cookTime,
        difficulty: recipeObj.difficulty,
      });
      if (result) return result;
    } catch (e) {
      log.debug("[recipe-extract] JSON-LD parse skip:", e);
    }
  }
  return null;
}

export function extractFromMicrodata(html: string): ExtractedRecipe | null {
  if (!/schema\.org\/Recipe/i.test(html)) return null;

  const names = collectItempropValues(html, "name");
  const title = names[0] ?? "";

  const yields = collectItempropValues(html, "recipeYield");
  const recipeYield = yields[0] ?? undefined;

  const prepTimes = collectItempropValues(html, "prepTime");
  const cookTimes = collectItempropValues(html, "cookTime");

  const ingredients = collectItempropValues(html, "recipeIngredient");
  if (ingredients.length === 0) return null;

  return buildExtractedRecipe({
    title,
    ingredientLines: ingredients,
    recipeYield,
    prepTime: prepTimes[0],
    cookTime: cookTimes[0],
    difficulty: undefined,
  });
}

export function hostnameToSourceName(hostname: string): string {
  const h = hostname.replace(/^www\./, "").split(":")[0] ?? hostname;
  const first = h.split(".")[0] ?? h;
  if (!first) return h;
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function applySourceMeta(recipe: ExtractedRecipe, url: string): ExtractedRecipe {
  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = "";
  }
  return {
    ...recipe,
    source_url: url,
    source_name: hostname ? hostnameToSourceName(hostname) : recipe.source_name,
  };
}

export function stripHtmlForAi(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function aiRowToIngredient(row: Record<string, unknown>): RecipeIngredient {
  const amount = row.amount;
  const unit = row.unit;
  return {
    name: String(row.name ?? ""),
    amount: typeof amount === "number" && Number.isFinite(amount) ? amount : null,
    unit: unit != null && String(unit).trim() !== "" ? String(unit) : null,
    category: typeof row.category === "string" ? row.category : "",
    notes: typeof row.notes === "string" ? row.notes : "",
    is_optional: Boolean(row.is_optional),
  };
}

export async function extractWithAI(pageText: string, url: string): Promise<ExtractedRecipe> {
  const parsed = await callClaudeJSON<Record<string, unknown>>({
    model: CLAUDE_MODEL_SONNET,
    system: RECIPE_EXTRACT_SYSTEM,
    max_tokens: 4096,
    temperature: 0,
    messages: [
      {
        role: "user",
        content: pageText,
      },
    ],
  });

  if (parsed.error === "no_recipe_found") {
    throw new Error("no_recipe_found");
  }

  const title = String(parsed.title ?? "");
  if (!title.trim()) {
    throw new Error("no_recipe_found");
  }

  const rawIngr = parsed.ingredients;
  const lines: Record<string, unknown>[] = Array.isArray(rawIngr)
    ? (rawIngr as Record<string, unknown>[])
    : [];

  if (lines.length === 0) {
    throw new Error("no_recipe_found");
  }

  const ingredients = lines.map((row) => aiRowToIngredient(row));

  const servingsRaw = parsed.servings;
  const servings =
    typeof servingsRaw === "number" && Number.isFinite(servingsRaw)
      ? Math.max(1, Math.round(servingsRaw))
      : 4;

  const prep =
    typeof parsed.prep_time_minutes === "number"
      ? Math.round(parsed.prep_time_minutes)
      : null;
  const cook =
    typeof parsed.cook_time_minutes === "number"
      ? Math.round(parsed.cook_time_minutes)
      : null;

  let hostname = "";
  try {
    hostname = new URL(url).hostname;
  } catch {
    hostname = "";
  }

  return {
    title: title.trim(),
    servings,
    servings_label:
      typeof parsed.servings_label === "string" && parsed.servings_label.trim()
        ? parsed.servings_label.trim()
        : "Portionen",
    ingredients,
    source_url: url,
    source_name: hostname ? hostnameToSourceName(hostname) : "",
    prep_time_minutes: prep,
    cook_time_minutes: cook,
    difficulty: mapDifficulty(parsed.difficulty),
  };
}

export async function extractRecipe(url: string): Promise<{
  recipe: ExtractedRecipe;
  method: "json-ld" | "microdata" | "ai-fallback";
}> {
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error("Invalid URL");
  }
  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Invalid URL protocol");
  }

  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      "User-Agent":
        "Mozilla/5.0 (compatible; DigitalShoppingList/1.0; +https://github.com/)",
      Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
    },
    signal: AbortSignal.timeout(30_000),
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch URL: HTTP ${res.status}`);
  }

  const html = await res.text();

  const fromLd = extractFromJsonLd(html);
  if (fromLd) {
    return { recipe: applySourceMeta(fromLd, url), method: "json-ld" };
  }

  const fromMicro = extractFromMicrodata(html);
  if (fromMicro) {
    return { recipe: applySourceMeta(fromMicro, url), method: "microdata" };
  }

  const text = stripHtmlForAi(html);
  try {
    const ai = await extractWithAI(text, url);
    return { recipe: applySourceMeta(ai, url), method: "ai-fallback" };
  } catch (err) {
    log.warn("[recipe-extract] AI fallback failed:", err);
    throw err;
  }
}
