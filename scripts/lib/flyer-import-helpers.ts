/**
 * Helper functions for batch flyer import.
 * AI calls, bbox matching, product processing, and cleanup.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { GoogleGenAI } from "@google/genai";
import { DEMAND_GROUPS_LIST } from "../../src/lib/products/demand-groups-list";
import { normalizeName } from "../../src/lib/products/normalize";
import { getDemandGroupFallback } from "../../src/lib/products/demand-group-fallback";
import { findExistingProduct } from "../../src/lib/products/find-existing";
import { upsertProduct } from "../../src/lib/products/upsert-product";
import { fetchOpenFoodFacts } from "../../src/lib/products/open-food-facts";
import {
  getAktionsartikelDemandGroupCode,
  getDefaultDemandGroupCode,
} from "../../src/lib/products/default-category";

// ── Types ───────────────────────────────────────────────────────

export interface ExtractedProduct {
  article_number?: string | null;
  name?: string;
  brand?: string | null;
  ean_barcode?: string | null;
  price?: number | null;
  weight_or_quantity?: string | null;
  demand_group?: string | null;
  demand_sub_group?: string | null;
  special_start_date?: string | null;
  special_end_date?: string | null;
  assortment_type?: string | null;
  is_private_label?: boolean | null;
  is_seasonal?: boolean | null;
}

interface DetectedProductBox {
  label: string;
  bbox: [number, number, number, number];
}

export interface FirstPageResult {
  detected_country?: string;
  flyer_title?: string;
  special_valid_from?: string | null;
  special_valid_to?: string | null;
  products: ExtractedProduct[];
}

export interface PageResult {
  products: ExtractedProduct[];
}

// ── Prompts ─────────────────────────────────────────────────────

const DEMAND_GROUPS_INSTRUCTION =
  "Ordne jedes Produkt einer demand_group und demand_sub_group zu. Verwende die OFFIZIELLEN ALDI Warengruppen-Codes (Format: '##-Name'). Wähle AUS DIESER LISTE – erfinde keine neuen Werte:\n\n" +
  "Demand Groups und ihre Sub-Groups:\n" +
  DEMAND_GROUPS_LIST.map((g) => `- ${g.group}: ${g.subGroups.join(", ")}`).join("\n");

const YEAR = new Date().getFullYear();

const ASSORTMENT_RULES = `WICHTIG für assortment_type – es gibt genau 3 Werte:
- "daily_range": Dauersortiment – reguläre Supermarktprodukte die dauerhaft im Sortiment sind. Auch wenn sie im Handzettel mit Preisaktion beworben werden!
- "special_food": Food-Aktionsartikel – Lebensmittel die nur einmalig angeliefert und abverkauft werden
- "special_nonfood": Non-Food-Aktionsartikel – Non-Food-Ware die zeitlich begrenzt angeboten wird
Die MEISTEN Lebensmittel im Handzettel sind "daily_range"!`;

const LABEL_RULES = `is_private_label: true = Eigenmarke (Milsani, Lacura, Tandil, GUT bio, MAMIA, Moser Roth, etc.), false = Fremdmarke (Nivea, Coca-Cola, etc.), null = unklar.
is_seasonal: true = jährlich wiederkehrendes Saisonprodukt (Spargel, Erdbeeren, Lebkuchen, Glühwein), false = kein Saisonprodukt.`;

const PRODUCT_FIELDS = `{ "article_number": "string or null", "name": "string", "price": number or null, "weight_or_quantity": "string or null", "brand": "string or null", "special_start_date": "YYYY-MM-DD or null", "special_end_date": "YYYY-MM-DD or null", "demand_group": "string or null", "demand_sub_group": "string or null", "assortment_type": "daily_range or special_food or special_nonfood", "is_private_label": true or false or null, "is_seasonal": true or false }`;

export const FIRST_PAGE_PROMPT = `Dies ist die ERSTE Seite eines Supermarkt-Handzettels. Extrahiere: (1) Handzettel-Titel (flyer_title), (2) Gültigkeitszeitraum (special_valid_from, special_valid_to, YYYY-MM-DD), (3) JEDES Produkt auf dieser Seite, (4) das Land anhand des Logos/Brandings.
Das aktuelle Jahr ist ${YEAR}. Wenn kein Jahr angegeben ist, verwende ${YEAR}.

LAND-ERKENNUNG (detected_country):
- ALDI SÜD (blaues ALDI-Logo) → "DE"
- Hofer (Hofer-Logo) → "AT"
- Unklar → "unknown"

Pro Produkt: article_number, name, price, weight_or_quantity, brand, special_start_date, special_end_date, demand_group, demand_sub_group, assortment_type, is_private_label, is_seasonal.

${ASSORTMENT_RULES}
${LABEL_RULES}
${DEMAND_GROUPS_INSTRUCTION}

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.
{ "photo_type": "flyer_pdf", "detected_country": "DE or AT or unknown", "flyer_title": "string", "special_valid_from": "YYYY-MM-DD or null", "special_valid_to": "YYYY-MM-DD or null", "products": [ ${PRODUCT_FIELDS} ] }`;

export const PAGE_PROMPT = `Dies ist eine Seite eines Supermarkt-Handzettels (nicht die erste). Extrahiere JEDES Produkt auf dieser Seite.
Das aktuelle Jahr ist ${YEAR}. Wenn kein Jahr angegeben ist, verwende ${YEAR}.
Pro Produkt: article_number, name, price, weight_or_quantity, brand, special_start_date, special_end_date, demand_group, demand_sub_group, assortment_type, is_private_label, is_seasonal.

${ASSORTMENT_RULES}
${LABEL_RULES}
${DEMAND_GROUPS_INSTRUCTION}

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.
{ "photo_type": "flyer_pdf", "products": [ ${PRODUCT_FIELDS} ] }`;

const GEMINI_DETECT_PROMPT = `Du siehst eine Seite eines Supermarkt-Handzettels (Werbebeilage).
Finde JEDEN einzelnen Produktbereich auf dieser Seite.
Pro Produkt gib zurück:
- "label": Kurzbezeichnung des Produkts (z.B. "Milch 3,5%", "Bananen")
- "bbox": Bounding Box als [y_min, x_min, y_max, x_max] mit Werten 0-1000 (normalisiert auf Seitengröße)
Die Bounding Box soll den gesamten Produktbereich umfassen: Produktbild, Name, Preis und ggf. Aktionsbanner.
Überlappungen zwischen Boxen vermeiden.
Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.
{ "products": [ { "label": "string", "bbox": [y_min, x_min, y_max, x_max] } ] }`;

// ── AI Calls ────────────────────────────────────────────────────

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callClaudeFlyer<T>(
  pdfBase64: string, prompt: string, model: string, apiKey: string,
): Promise<T> {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model,
          max_tokens: 16384,
          messages: [{
            role: "user",
            content: [
              { type: "document", source: { type: "base64", media_type: "application/pdf", data: pdfBase64 } },
              { type: "text", text: prompt },
            ],
          }],
        }),
      });
      if (!res.ok) {
        const errText = await res.text();
        if (attempt < MAX_RETRIES && (res.status === 429 || res.status >= 500)) {
          console.log(`    Claude ${res.status}, retry ${attempt}/${MAX_RETRIES}...`);
          await sleep(RETRY_DELAY_MS);
          continue;
        }
        throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`);
      }
      const data = await res.json();
      const text: string = data.content?.[0]?.text ?? "";
      const cleaned = text.replace(/^```json?\s*/i, "").replace(/\s*```\s*$/i, "").trim();
      return JSON.parse(cleaned) as T;
    } catch (e) {
      if (attempt < MAX_RETRIES && e instanceof TypeError) {
        console.log(`    Claude network error, retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      throw e;
    }
  }
  throw new Error("Claude: max retries exceeded");
}

export async function detectProductBoxes(
  pdfBase64: string, model: string, apiKey: string,
): Promise<DetectedProductBox[]> {
  if (!apiKey) return [];
  const ai = new GoogleGenAI({ apiKey });

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{
          role: "user",
          parts: [
            { inlineData: { mimeType: "application/pdf", data: pdfBase64 } },
            { text: GEMINI_DETECT_PROMPT },
          ],
        }],
      });
      const text = response.text?.trim() ?? "";
      const cleaned = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "");
      const parsed = JSON.parse(cleaned) as { products?: DetectedProductBox[] };
      if (!Array.isArray(parsed.products)) return [];
      return parsed.products.filter(
        (p) =>
          typeof p.label === "string" && p.label.length > 0 &&
          Array.isArray(p.bbox) && p.bbox.length === 4 &&
          p.bbox.every((v) => typeof v === "number" && v >= 0 && v <= 1000),
      );
    } catch (e) {
      if (attempt < MAX_RETRIES) {
        console.log(`    Gemini error, retry ${attempt}/${MAX_RETRIES}...`);
        await sleep(RETRY_DELAY_MS);
        continue;
      }
      console.warn("    Gemini failed after retries:", e instanceof Error ? e.message : e);
      return [];
    }
  }
  return [];
}

// ── Bbox Matching (mirrors src/lib/api/photo-processing/gemini-detect.ts) ──

export function matchBboxesToProducts(
  boxes: DetectedProductBox[], productNames: string[],
): Map<string, [number, number, number, number]> {
  const result = new Map<string, [number, number, number, number]>();
  if (boxes.length === 0 || productNames.length === 0) return result;

  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-zäöüß0-9]/g, " ").replace(/\s+/g, " ").trim();
  const usedBoxIndices = new Set<number>();

  for (const name of productNames) {
    const nameNorm = norm(name);
    const nameWords = nameNorm.split(" ").filter((w) => w.length > 2);
    let bestIdx = -1;
    let bestScore = 0;

    for (let i = 0; i < boxes.length; i++) {
      if (usedBoxIndices.has(i)) continue;
      const labelNorm = norm(boxes[i].label);
      if (nameNorm === labelNorm) { bestIdx = i; bestScore = 100; break; }
      if (nameNorm.includes(labelNorm) || labelNorm.includes(nameNorm)) {
        if (80 > bestScore) { bestScore = 80; bestIdx = i; }
        continue;
      }
      const labelWords = labelNorm.split(" ").filter((w) => w.length > 2);
      const matching = nameWords.filter((w) =>
        labelWords.some((lw) => lw.includes(w) || w.includes(lw)),
      );
      const score = nameWords.length > 0
        ? (matching.length / Math.max(nameWords.length, labelWords.length)) * 70
        : 0;
      if (score > bestScore) { bestScore = score; bestIdx = i; }
    }
    if (bestIdx >= 0 && bestScore >= 20) {
      result.set(name, boxes[bestIdx].bbox);
      usedBoxIndices.add(bestIdx);
    }
  }
  return result;
}

// ── Product Processing (mirrors src/app/api/process-flyer-page/route.ts) ──

export async function processPageProducts(
  supabase: SupabaseClient,
  products: ExtractedProduct[],
  flyerId: string,
  pageNumber: number,
  bboxMap: Map<string, [number, number, number, number]>,
  flyerCountry: string,
  validFrom: string,
  validTo: string,
  defaultCategoryId: string,
): Promise<{ created: number; updated: number }> {
  let created = 0;
  let updated = 0;
  const defaultCode = getDefaultDemandGroupCode();
  const aktionCode = getAktionsartikelDemandGroupCode();
  const now = new Date().toISOString();

  await supabase.from("flyer_page_products").delete()
    .eq("flyer_id", flyerId).eq("page_number", pageNumber);

  for (const p of products) {
    const name = (p.name || "").trim();
    if (!name) continue;

    const nameNorm = normalizeName(name);
    const ean = p.ean_barcode?.trim() || null;
    let offData: Awaited<ReturnType<typeof fetchOpenFoodFacts>> = null;
    if (ean) offData = await fetchOpenFoodFacts(ean);

    const articleNumber = p.article_number != null ? String(p.article_number).trim() || null : null;
    const price = typeof p.price === "number" ? p.price : null;
    const brand = (p.brand ?? offData?.brand ?? null)?.trim() || null;
    const displayName = (offData?.name ?? name).trim();
    const fallback = getDemandGroupFallback(displayName);
    const demandGroup = (p.demand_group?.trim() || null) ?? fallback?.demand_group ?? null;
    const demandSubGroup = (p.demand_sub_group?.trim() || null) ?? fallback?.demand_sub_group ?? null;
    const nameNormalized = normalizeName(displayName);
    const specialStart = p.special_start_date ?? validFrom;
    const specialEnd = p.special_end_date ?? validTo;

    const existing = await findExistingProduct(supabase, {
      article_number: articleNumber, ean_barcode: ean, name_normalized: nameNorm,
    }, { skipEan: true, fuzzy: true });

    let productId: string | null = null;

    if (existing) {
      const result = await upsertProduct(supabase, {
        name: displayName, name_normalized: nameNormalized,
        article_number: articleNumber, brand, price,
        ...(price != null ? { price_updated_at: now } : {}),
        ean_barcode: ean, demand_group: demandGroup, demand_sub_group: demandSubGroup,
        ...(p.is_private_label != null ? { is_private_label: p.is_private_label } : {}),
        ...(p.is_seasonal === true ? { is_seasonal: true } : {}),
        special_start_date: specialStart, special_end_date: specialEnd,
      }, existing.product_id);
      if (result) { updated++; productId = result.product_id; }
      else { console.warn(`      Update failed for "${displayName}" (${existing.product_id})`); }
    } else {
      const assortmentType = p.assortment_type === "special_nonfood" ? "special_nonfood" : "special_food";
      const insertData = {
        name: displayName, name_normalized: nameNormalized,
        category_id: defaultCategoryId,
        demand_group_code: aktionCode ?? defaultCode,
        article_number: articleNumber, brand, price,
        price_updated_at: price != null ? now : null,
        assortment_type: assortmentType, source: "import" as const,
        ean_barcode: ean, demand_group: demandGroup, demand_sub_group: demandSubGroup,
        special_start_date: specialStart, special_end_date: specialEnd,
        country: flyerCountry, is_private_label: p.is_private_label ?? null,
        is_seasonal: p.is_seasonal === true,
      };
      const result = await upsertProduct(supabase, insertData);
      if (result) { created++; productId = result.product_id; }
      else { console.warn(`      Insert failed for "${displayName}" (${nameNormalized})`); }
    }

    if (productId) {
      const bbox = bboxMap.get(name) ?? null;
      await supabase.from("flyer_page_products").upsert({
        flyer_id: flyerId, page_number: pageNumber, product_id: productId,
        price_in_flyer: price,
        bbox: bbox ? { y_min: bbox[0], x_min: bbox[1], y_max: bbox[2], x_max: bbox[3] } : null,
      }, { onConflict: "flyer_id,page_number,product_id" });
    }
  }
  return { created, updated };
}

// ── Processed-file tracking ─────────────────────────────────────

export interface ProcessedEntry {
  flyerId: string;
  processedAt: string;
}

export function filterNewFiles(
  allFiles: string[],
  processed: Record<string, ProcessedEntry>,
  opts: { force?: boolean; dryRun?: boolean },
): { files: string[]; skipped: string[] } {
  if (opts.force || opts.dryRun) {
    return { files: allFiles, skipped: [] };
  }
  const files = allFiles.filter((f) => !processed[f]);
  const skipped = allFiles.filter((f) => !!processed[f]);
  return { files, skipped };
}

// ── Delete Existing Flyers ──────────────────────────────────────

export async function deleteExistingFlyers(
  supabase: SupabaseClient, country: string,
): Promise<number> {
  const { data: flyers } = await supabase
    .from("flyers").select("flyer_id, total_pages").eq("country", country);
  if (!flyers?.length) return 0;

  for (const flyer of flyers) {
    await supabase.from("flyer_page_products").delete().eq("flyer_id", flyer.flyer_id);
    await supabase.from("flyer_pages").delete().eq("flyer_id", flyer.flyer_id);
    const pages = flyer.total_pages ?? 0;
    if (pages > 0) {
      const paths = Array.from({ length: pages }, (_, i) => `${flyer.flyer_id}/page-${i + 1}.pdf`);
      await supabase.storage.from("flyer-pages").remove(paths);
    }
    await supabase.from("flyers").delete().eq("flyer_id", flyer.flyer_id);
  }
  return flyers.length;
}
