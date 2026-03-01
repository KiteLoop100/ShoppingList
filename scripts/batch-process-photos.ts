/**
 * Batch-process product photos from local folders into Supabase.
 *
 * Reads .jpg/.jpeg/.png/.webp from photos/DE or photos/AT,
 * sends each to Claude Vision for extraction, generates thumbnails,
 * and upserts products in Supabase – the same pipeline as the web
 * capture flow but without a browser.
 *
 * Usage:
 *   npx tsx scripts/batch-process-photos.ts --country AT
 *   npx tsx scripts/batch-process-photos.ts --country DE --limit 3 --dry-run
 *
 * Options:
 *   --country DE|AT   Which folder to process (required)
 *   --limit N         Process only the first N photos (for testing)
 *   --dry-run         Extract data but don't write to Supabase
 *   --concurrency N   Parallel Claude calls (default 3)
 *   --skip-thumbnails Don't generate/upload thumbnails
 *
 * Prerequisites:
 *   .env.local with ANTHROPIC_API_KEY, NEXT_PUBLIC_SUPABASE_URL,
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from "dotenv";
import { resolve, basename, extname } from "path";
import { readdirSync, readFileSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { randomUUID } from "crypto";
import sharp from "sharp";

config({ path: resolve(process.cwd(), ".env.local") });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const CLAUDE_MODEL = "claude-sonnet-4-5-20250929";
const SUPPORTED_EXTS = new Set([".jpg", ".jpeg", ".png", ".webp"]);

// ── CLI args ────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    country: "",
    limit: Infinity,
    dryRun: false,
    concurrency: 3,
    skipThumbnails: false,
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--country":
        opts.country = (args[++i] ?? "").toUpperCase();
        break;
      case "--limit":
        opts.limit = parseInt(args[++i] ?? "0", 10) || Infinity;
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--concurrency":
        opts.concurrency = parseInt(args[++i] ?? "3", 10) || 3;
        break;
      case "--skip-thumbnails":
        opts.skipThumbnails = true;
        break;
    }
  }
  return opts;
}

// ── Shared logic (mirrors src/lib/products) ─────────────────────

function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// ── Claude Vision prompt ────────────────────────────────────────

const DEMAND_GROUPS_INSTRUCTION =
  "Ordne jedes Produkt einer demand_group und demand_sub_group zu. Wähle AUS DIESER LISTE – erfinde keine neuen Werte:\n\n" +
  "Demand Groups und ihre Sub-Groups:\n" +
  "- Brot & Backwaren: Brot, Brötchen, Toast, Kuchen / Gebäck, Knäckebrot / Cracker, Tortillas / Wraps\n" +
  "- Drogerie & Körperpflege: Deodorant, Duschgel, Gesichtspflege, Haarpflege, Haarstyling, Körperpflege, Kosmetik / Make-up, Mundpflege, Rasur, Seife / Handpflege, Zahnpflege, Baby-/Kinderpflege\n" +
  "- Feinkost & Delikatessen: Antipasti / Delikatessen, Aufstriche BIO, Crackers / Gebäck, Pralinen / Confiserie\n" +
  "- Fertiggerichte: Pasta / Teigwaren, Suppen, Eintöpfe\n" +
  "- Fisch & Meeresfrüchte: Fischfilet, Garnelen, Lachs, Räucherlachs, Räucherfisch, Hering, Matjes\n" +
  "- Frischfleisch: Geflügel, Hackfleisch gemischt, Hackfleisch Rind, Rindfleisch, Kalbfleisch\n" +
  "- Frühstück & Cerealien: Cerealien / Müsli, Porridge / Haferflocken, Aufstriche / Brotbelag, Backmischung\n" +
  "- Getränke: Mineralwasser, Cola, Limonade / Softdrink, Eistee, Frischsaft / Smoothie, Pflanzenmilch\n" +
  "- Gewürze & Würzmittel: Gewürze gemahlen, Kräuter getrocknet, Pfeffer, Salz\n" +
  "- Grundnahrungsmittel: Mehl, Zucker, Speiseöl, Essig, Backzutaten, Hefe\n" +
  "- Haushalt & Küche: Alufolie, Backpapier, Frischhaltefolie, Gefrierbeutel\n" +
  "- Hygieneartikel: Damenhygiene, Tampons, Inkontinenz\n" +
  "- Kaffee & Tee: Kaffee, Kaffee / Espresso, Kaffee / Kapselkaffee, Tee\n" +
  "- Käse: Frischkäse, Hartkäse, Schnittkäse, Weichkäse, Reibekäse, Schmelzkäse, Ziegenkäse\n" +
  "- Milchprodukte: Butter, Joghurt, Sahne, Quark, Milch, Eier\n" +
  "- Obst & Gemüse: Gemüse / Tomaten, Gemüse / Paprika, Gemüse / Gurken, Gemüse / Kartoffeln, Gemüse / Salat, Gemüse / Zwiebeln, Obst / Bananen, Obst / Zitrusfrüchte, Obst / Kernobst, Beeren / Obst, Kräuter frisch, Pilze\n" +
  "- Papierprodukte & Haushalt: Toilettenpapier, Küchenrolle, Taschentücher, Servietten\n" +
  "- Pasta & Reis: Pasta, Pastasaucen, Reis\n" +
  "- Saucen & Dressings: Ketchup, Mayonnaise, BBQ Sauce, Senf, Salatdressing\n" +
  "- Spirituosen: Gin, Vodka, Whisky, Rum\n" +
  "- Süßwaren & Snacks: Schokolade, Chips / Knabbergebäck, Fruchtgummi, Kekse / Gebäck, Nüsse / Trockenfrüchte, Schokoriegel\n" +
  "- Tiefkühl: TK-Pizza, TK-Gemüse, TK-Fisch, TK-Fertiggerichte, Eis / Eiscreme, TK-Backwaren\n" +
  "- Tierbedarf: Katzenstreu, Katzenfutter, Hundefutter\n" +
  "- Waschmittel & Reinigung: Waschmittel flüssig, Spülmaschinentabs, Spülmittel, Allzweckreiniger, WC-Reiniger, Weichspüler, Müllsäcke\n" +
  "- Wein: Rotwein, Weißwein trocken, Rosé\n" +
  "- World Food & Konserven: Asia Fertiggerichte, Fischkonserven, Konserven / Tomaten, Öle & Essig, Pesto / Saucen\n" +
  "- Wurst & Aufschnitt: Salami, Schinken, Kochschinken, Aufschnitt, Geflügelaufschnitt, Rohschinken";

const BATCH_VISION_PROMPT = `Du analysierst Fotos aus einem Supermarkt (ALDI SÜD / Hofer). Klassifiziere den Foto-Typ und extrahiere strukturierte Produktdaten.

Foto-Typen:
- "shelf": Regalfoto mit digitalen Preisschildern – extrahiere JEDES sichtbare Produkt mit Name und Preis vom Preisschild.
- "product_front": Einzelnes Produkt von vorne – extrahiere Name, Marke, Preis, Gewicht etc.
- "product_back": Produktrückseite mit Barcode/Nährwerten – extrahiere nur EAN-Barcode.
- "price_tag": Digitales Preisschild (Nahaufnahme) – extrahiere Produktname, Preis, Artikelnummer, Gewicht.

Bei Regalfotos mit digitalen Preisschildern:
- Lies JEDEN sichtbaren Preisschild-Eintrag ab
- Der Produktname steht groß auf dem Preisschild
- Der Preis steht prominent (z.B. "1.29", "0,99")
- Artikelnummer steht klein auf dem Preisschild (falls sichtbar)
- Gewicht/Menge steht auf dem Preisschild (z.B. "500g", "1L")
- Marke steht manchmal auf dem Preisschild oder ist vom Produkt ablesbar

${DEMAND_GROUPS_INSTRUCTION}

Antworte ausschließlich mit validem JSON. Kein Markdown, keine Backticks.

{
  "photo_type": "shelf" | "product_front" | "product_back" | "price_tag",
  "products": [
    {
      "name": "string",
      "brand": "string or null",
      "price": number or null,
      "article_number": "string or null",
      "ean_barcode": "string or null",
      "weight_or_quantity": "string or null",
      "demand_group": "string or null",
      "demand_sub_group": "string or null"
    }
  ]
}`;

// ── Types ───────────────────────────────────────────────────────

interface ExtractedProduct {
  name: string;
  brand?: string | null;
  price?: number | null;
  article_number?: string | null;
  ean_barcode?: string | null;
  weight_or_quantity?: string | null;
  demand_group?: string | null;
  demand_sub_group?: string | null;
}

interface ClaudeResponse {
  photo_type: string;
  products: ExtractedProduct[];
}

interface BatchResult {
  file: string;
  photo_type: string;
  products_extracted: number;
  products_created: number;
  products_updated: number;
  products_skipped: number;
  errors: string[];
  products: Array<ExtractedProduct & { status: "created" | "updated" | "skipped" | "error" }>;
}

// ── Claude API call ─────────────────────────────────────────────

async function callClaude(
  imageBase64: string,
  mediaType: string
): Promise<ClaudeResponse> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 8192,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            { type: "text", text: BATCH_VISION_PROMPT },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Claude API ${res.status}: ${errText.slice(0, 300)}`);
  }

  const data = await res.json();
  const text: string = data.content?.[0]?.text ?? "";
  const cleaned = text
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
  return JSON.parse(cleaned) as ClaudeResponse;
}

// ── Thumbnail generation ────────────────────────────────────────

async function makeThumbnail(imageBuffer: Buffer): Promise<Buffer> {
  return sharp(imageBuffer)
    .rotate()
    .resize(150, 150, { fit: "cover", position: "center" })
    .jpeg({ quality: 85 })
    .toBuffer();
}

// ── Open Food Facts ─────────────────────────────────────────────

async function fetchOpenFoodFacts(ean: string) {
  try {
    const res = await fetch(
      `https://world.openfoodfacts.org/api/v2/product/${ean}.json?fields=product_name,brands,nutriments,ingredients_text,allergens`,
      { headers: { "User-Agent": "DigitalShoppingList/1.0" } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.product) return null;
    const p = data.product;
    return {
      name: p.product_name ?? undefined,
      brand: p.brands ?? undefined,
      nutrition_info: (p.nutriments as Record<string, unknown>) ?? undefined,
      ingredients: p.ingredients_text ?? undefined,
      allergens: p.allergens ?? undefined,
    };
  } catch {
    return null;
  }
}

// ── Concurrency helper ──────────────────────────────────────────

async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const i = nextIndex++;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

// ── Main ────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!opts.country || !["DE", "AT"].includes(opts.country)) {
    console.error("❌ --country DE oder --country AT angeben");
    process.exit(1);
  }
  if (!ANTHROPIC_API_KEY) {
    console.error("❌ ANTHROPIC_API_KEY fehlt in .env.local");
    process.exit(1);
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ SUPABASE_URL oder SUPABASE_KEY fehlt in .env.local");
    process.exit(1);
  }

  const photosDir = resolve(process.cwd(), "photos", opts.country);
  let files: string[];
  try {
    files = readdirSync(photosDir)
      .filter((f) => SUPPORTED_EXTS.has(extname(f).toLowerCase()))
      .sort();
  } catch {
    console.error(`❌ Ordner nicht gefunden: ${photosDir}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error(`❌ Keine Fotos gefunden in ${photosDir}`);
    console.error("   Unterstützte Formate: .jpg, .jpeg, .png, .webp");
    process.exit(1);
  }

  if (opts.limit < files.length) {
    files = files.slice(0, opts.limit);
  }

  console.log(`\n🛒 Batch-Fotoverarbeitung (${opts.country})\n`);
  console.log(`📁 Ordner:      ${photosDir}`);
  console.log(`📷 Fotos:       ${files.length}`);
  console.log(`⚡ Parallelität: ${opts.concurrency}`);
  if (opts.dryRun) console.log("🔍 DRY RUN – keine Daten werden geschrieben");
  console.log("");

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // Get default category
  const { data: categories } = await supabase
    .from("categories")
    .select("category_id")
    .limit(1);
  const defaultCategoryId = categories?.[0]?.category_id;
  if (!defaultCategoryId && !opts.dryRun) {
    console.error("❌ Keine Kategorien in der Datenbank. Bitte zuerst Seed-Daten importieren.");
    process.exit(1);
  }

  const allResults: BatchResult[] = [];
  let totalCreated = 0;
  let totalUpdated = 0;
  let totalSkipped = 0;
  let totalErrors = 0;

  await mapConcurrent(files, opts.concurrency, async (file, index) => {
    const filePath = resolve(photosDir, file);
    const result: BatchResult = {
      file,
      photo_type: "unknown",
      products_extracted: 0,
      products_created: 0,
      products_updated: 0,
      products_skipped: 0,
      errors: [],
      products: [],
    };

    try {
      process.stdout.write(
        `\r[${index + 1}/${files.length}] ${file.padEnd(40).slice(0, 40)} `
      );

      // Read and resize image
      const rawBuffer = readFileSync(filePath);
      const resized = await sharp(rawBuffer)
        .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer();
      const imageBase64 = resized.toString("base64");

      // Call Claude Vision
      const claudeResult = await callClaude(imageBase64, "image/jpeg");
      result.photo_type = claudeResult.photo_type;
      const products = claudeResult.products ?? [];
      result.products_extracted = products.length;

      process.stdout.write(
        `→ ${claudeResult.photo_type} (${products.length} Produkt${products.length !== 1 ? "e" : ""})`
      );

      if (products.length === 0) {
        result.products_skipped = 1;
        process.stdout.write(" ⚠️  Keine Produkte erkannt\n");
        allResults.push(result);
        return;
      }

      // Process each product
      for (const p of products) {
        const name = (p.name || "").trim();
        if (!name) {
          result.products_skipped++;
          result.products.push({ ...p, status: "skipped" });
          continue;
        }

        const nameNormalized = normalizeName(name);
        const ean = p.ean_barcode?.trim() || null;
        const articleNumber = p.article_number?.trim() || null;
        const price = typeof p.price === "number" ? p.price : null;
        const brand = p.brand?.trim() || null;

        // Open Food Facts for EAN
        let offData: Awaited<ReturnType<typeof fetchOpenFoodFacts>> = null;
        if (ean) offData = await fetchOpenFoodFacts(ean);

        const displayName = (offData?.name ?? name).trim();
        const finalNameNorm = normalizeName(displayName);

        if (opts.dryRun) {
          result.products_created++;
          result.products.push({ ...p, name: displayName, status: "created" });
          continue;
        }

        // Duplicate check
        let existingId: string | null = null;
        if (articleNumber) {
          const { data: byArticle } = await supabase
            .from("products")
            .select("product_id")
            .eq("article_number", articleNumber)
            .eq("status", "active")
            .maybeSingle();
          if (byArticle) existingId = byArticle.product_id;
        }
        if (!existingId && ean) {
          const { data: byEan } = await supabase
            .from("products")
            .select("product_id")
            .eq("ean_barcode", ean)
            .eq("status", "active")
            .maybeSingle();
          if (byEan) existingId = byEan.product_id;
        }
        if (!existingId) {
          const { data: byName } = await supabase
            .from("products")
            .select("product_id")
            .ilike("name_normalized", finalNameNorm)
            .eq("status", "active")
            .limit(1)
            .maybeSingle();
          if (byName) existingId = byName.product_id;
        }

        const now = new Date().toISOString();

        if (existingId) {
          // Update existing product
          const updates: Record<string, unknown> = { updated_at: now };
          if (price != null) {
            updates.price = price;
            updates.price_updated_at = now;
          }
          if (articleNumber) updates.article_number = articleNumber;
          if (brand) updates.brand = brand;
          if (ean) updates.ean_barcode = ean;
          if (p.demand_group) updates.demand_group = p.demand_group;
          if (p.demand_sub_group) updates.demand_sub_group = p.demand_sub_group;
          if (p.weight_or_quantity) updates.weight_or_quantity = p.weight_or_quantity;
          if (offData?.nutrition_info) updates.nutrition_info = offData.nutrition_info;
          if (offData?.ingredients) updates.ingredients = offData.ingredients;
          if (offData?.allergens) updates.allergens = offData.allergens;

          const { error } = await supabase
            .from("products")
            .update(updates)
            .eq("product_id", existingId);

          if (error) {
            result.errors.push(`Update ${displayName}: ${error.message}`);
            result.products.push({ ...p, name: displayName, status: "error" });
          } else {
            result.products_updated++;
            result.products.push({ ...p, name: displayName, status: "updated" });
          }
        } else {
          // Generate thumbnail
          let thumbnailUrl: string | null = null;
          if (
            !opts.skipThumbnails &&
            (claudeResult.photo_type === "product_front" || products.length === 1)
          ) {
            try {
              const thumbBuffer = await makeThumbnail(rawBuffer);
              const thumbId = randomUUID();
              const thumbPath = `batch/${thumbId}.jpg`;
              const { error: upErr } = await supabase.storage
                .from("product-thumbnails")
                .upload(thumbPath, thumbBuffer, {
                  contentType: "image/jpeg",
                  upsert: true,
                });
              if (!upErr) {
                const { data: urlData } = supabase.storage
                  .from("product-thumbnails")
                  .getPublicUrl(thumbPath);
                thumbnailUrl = urlData.publicUrl;
              }
            } catch {
              // thumbnail generation is best-effort
            }
          }

          const { error: insErr } = await supabase.from("products").insert({
            name: displayName,
            name_normalized: finalNameNorm,
            category_id: defaultCategoryId,
            article_number: articleNumber,
            brand: brand ?? offData?.brand ?? null,
            price,
            price_updated_at: price != null ? now : null,
            assortment_type: "daily_range",
            availability: "national",
            status: "active",
            source: "import",
            ean_barcode: ean,
            demand_group: p.demand_group ?? null,
            demand_sub_group: p.demand_sub_group ?? null,
            weight_or_quantity: p.weight_or_quantity ?? null,
            nutrition_info: offData?.nutrition_info ?? null,
            ingredients: offData?.ingredients ?? null,
            allergens: offData?.allergens ?? null,
            country: opts.country,
            thumbnail_url: thumbnailUrl,
            created_at: now,
            updated_at: now,
          });

          if (insErr) {
            result.errors.push(`Insert ${displayName}: ${insErr.message}`);
            result.products.push({ ...p, name: displayName, status: "error" });
          } else {
            result.products_created++;
            result.products.push({ ...p, name: displayName, status: "created" });
          }
        }
      }

      const counts = [
        result.products_created > 0 ? `${result.products_created} neu` : null,
        result.products_updated > 0 ? `${result.products_updated} aktualisiert` : null,
        result.products_skipped > 0 ? `${result.products_skipped} übersprungen` : null,
      ]
        .filter(Boolean)
        .join(", ");
      process.stdout.write(` → ${counts}\n`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(msg);
      process.stdout.write(` ❌ ${msg.slice(0, 80)}\n`);
    }

    totalCreated += result.products_created;
    totalUpdated += result.products_updated;
    totalSkipped += result.products_skipped;
    totalErrors += result.errors.length;
    allResults.push(result);
  });

  // Save results
  const resultsPath = resolve(
    process.cwd(),
    `batch-results-${opts.country}-${new Date().toISOString().slice(0, 10)}.json`
  );
  writeFileSync(resultsPath, JSON.stringify(allResults, null, 2), "utf-8");

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log(`📷 Fotos verarbeitet:  ${files.length}`);
  console.log(`✅ Produkte erstellt:  ${totalCreated}`);
  console.log(`🔄 Produkte aktualisiert: ${totalUpdated}`);
  console.log(`⏭️  Übersprungen:       ${totalSkipped}`);
  console.log(`❌ Fehler:             ${totalErrors}`);
  console.log(`📄 Ergebnis-Datei:     ${resultsPath}`);
  if (opts.dryRun) console.log("\n🔍 DRY RUN – keine Daten wurden geschrieben.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((e) => {
  console.error("\n❌ Unerwarteter Fehler:", e);
  process.exit(1);
});
