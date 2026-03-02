/**
 * Admin: batch-reclassify products via Claude (category_id + assortment_type).
 * Processes BATCH_SIZE products per request. Caller loops until `done: true`.
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { loadCategories, buildCategoryListPrompt } from "@/lib/categories/constants";
import { CLAUDE_MODEL_HAIKU } from "@/lib/api/config";
import { requireApiKey, requireAdminAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { callClaudeJSON } from "@/lib/api/claude-client";

const BATCH_SIZE = 40;

const reclassifySchema = z.object({
  offset: z.number().int().min(0).optional().default(0),
  country: z.string().min(1).max(5).optional(),
});

export async function POST(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const apiKeyCheck = requireApiKey();
  if (apiKeyCheck instanceof NextResponse) return apiKeyCheck;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const CATEGORIES = await loadCategories(supabase);
  const CATEGORY_LIST = buildCategoryListPrompt(CATEGORIES);
  const VALID_IDS = new Set(CATEGORIES.map((c) => c.id));

  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    rawBody = {};
  }
  const parsed = reclassifySchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", details: parsed.error.flatten() },
      { status: 400 }
    );
  }
  const { offset, country } = parsed.data;

  let query = supabase
    .from("products")
    .select("product_id, name, brand, category_id, assortment_type")
    .eq("status", "active");
  if (country) query = query.eq("country", country);
  const { data: batch, error: fetchErr } = await query
    .order("name", { ascending: true })
    .range(offset, offset + BATCH_SIZE - 1);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!batch || batch.length === 0) {
    return NextResponse.json({ done: true, updated: 0, offset, message: "Fertig." });
  }

  const productList = batch
    .map((p) => {
      const brandPart = p.brand ? ` (${p.brand})` : "";
      return `${p.product_id}: ${p.name}${brandPart}`;
    })
    .join("\n");

  const prompt = `Du bist ein Supermarkt-Experte. Ordne jedem Produkt eine category_id, einen assortment_type, eine availability, is_private_label und is_seasonal zu.

Verfügbare Kategorien:
${CATEGORY_LIST}

Regeln für assortment_type – es gibt genau 3 Werte:
- "daily_range": Dauersortiment – reguläre Supermarktprodukte die dauerhaft im Sortiment sind (Milch, Brot, Obst, Grundnahrungsmittel, Haushaltswaren usw.)
- "special_food": Food-Aktionsartikel – Lebensmittel die nur einmalig angeliefert und abverkauft werden (saisonale Spezialitäten, limitierte Food-Editionen)
- "special_nonfood": Non-Food-Aktionsartikel – Non-Food-Ware die zeitlich begrenzt angeboten wird (Kleidung, Elektronik, Werkzeug usw.)

Die MEISTEN Supermarktprodukte sind "daily_range"! Auch wenn ein Produkt im Werbeprospekt mit Preisreduzierung beworben wird, bleibt es "daily_range" wenn es regulär im Sortiment ist.

Regeln für availability:
- "national": Überregional/Landesweit verfügbar (Standard)
- "regional": Nur in bestimmten Regionen verfügbar
- "seasonal": Saisonal verfügbar (z.B. Spargel, Glühwein) – aber trotzdem Dauersortiment in der Saison

is_private_label (boolean oder null):
- true = Eigenmarke von ALDI/Hofer (z.B. Milsani, Lacura, Tandil, GUT bio, MAMIA, Moser Roth, Meine Metzgerei, Casa Morando, Ombra, River, Crane)
- false = Fremdmarke / Markenprodukt (z.B. Nivea, Coca-Cola, Haribo, Nutella, Persil)
- null = nicht erkennbar (z.B. generische Produkte ohne Markenangabe)

is_seasonal (boolean):
- true = Saisonprodukt das jährlich wiederkehrt (Spargel, Erdbeeren, Lebkuchen, Glühwein, Christstollen, Osterhasen)
- false = kein Saisonprodukt
HINWEIS: is_seasonal ist NICHT dasselbe wie assortment_type "special". Aktionsartikel kommen einmal; Saisonprodukte kehren jährlich wieder.

Produktliste:
${productList}

Antworte NUR mit einem JSON-Array. Kein Markdown, keine Backticks.
[{"product_id":"uuid","category_id":"uuid","assortment_type":"daily_range oder special_food oder special_nonfood","availability":"national oder regional oder seasonal","is_private_label":true oder false oder null,"is_seasonal":true oder false}, ...]`;

  let parsed: Array<{
    product_id: string;
    category_id: string;
    assortment_type: string;
    availability?: string;
    is_private_label?: boolean | null;
    is_seasonal?: boolean;
  }> = [];

  try {
    parsed = await callClaudeJSON<typeof parsed>({
      model: CLAUDE_MODEL_HAIKU,
      messages: [{ role: "user", content: prompt }],
      max_tokens: 8192,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Claude parse error: ${msg}` }, { status: 502 });
  }

  const batchIds = new Set(batch.map((p) => p.product_id));
  let updated = 0;
  const now = new Date().toISOString();

  const VALID_ASSORTMENT = new Set(["daily_range", "special_food", "special_nonfood"]);
  const VALID_AVAILABILITY = new Set(["national", "regional", "seasonal"]);

  for (const item of parsed) {
    if (!batchIds.has(item.product_id)) continue;
    if (!VALID_IDS.has(item.category_id)) continue;
    const at = VALID_ASSORTMENT.has(item.assortment_type) ? item.assortment_type : "daily_range";
    const av = item.availability && VALID_AVAILABILITY.has(item.availability) ? item.availability : "national";

    const plVal = typeof item.is_private_label === "boolean" ? item.is_private_label : null;
    const seVal = item.is_seasonal === true;

    const { error: updErr } = await supabase
      .from("products")
      .update({
        category_id: item.category_id,
        assortment_type: at,
        availability: av,
        is_private_label: plVal,
        is_seasonal: seVal,
        updated_at: now,
      })
      .eq("product_id", item.product_id);
    if (!updErr) updated++;
  }

  let countQuery = supabase
    .from("products")
    .select("product_id", { count: "exact", head: true })
    .eq("status", "active");
  if (country) countQuery = countQuery.eq("country", country);
  const { count: totalProducts } = await countQuery;

  const nextOffset = offset + batch.length;
  const done = batch.length < BATCH_SIZE;

  return NextResponse.json({
    done,
    updated,
    offset: nextOffset,
    total: totalProducts ?? 0,
    processed: nextOffset,
    message: done
      ? `Fertig. ${updated} Produkte in diesem Batch aktualisiert.`
      : `Batch ${Math.ceil(nextOffset / BATCH_SIZE)}: ${updated} aktualisiert, ${(totalProducts ?? 0) - nextOffset} verbleibend.`,
  });
}
