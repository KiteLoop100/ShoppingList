/**
 * Import ~100–200 ALDI SÜD–style test products into Supabase products table.
 * Uses a built-in list of typical product names (no scraping). Run after categories exist.
 *
 * Usage: npx tsx scripts/import-test-products.ts
 *         npx tsx scripts/import-test-products.ts --check   (prüft, ob .env.local geladen wird)
 * Requires: .env.local with NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or ANON_KEY)
 */

import path from "path";
import crypto from "crypto";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[äöüß]/g, (c) => ({ ä: "a", ö: "o", ü: "u", ß: "ss" }[c] ?? c))
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toUuid(seed: string): string {
  const h = crypto.createHash("sha1").update(seed).digest("hex");
  return [h.slice(0, 8), h.slice(8, 12), "4" + h.slice(13, 16), ((parseInt(h.slice(16, 18), 16) & 0x3f) | 0x80).toString(16) + h.slice(18, 20), h.slice(20, 32)].join("-");
}

/** Category name -> demand_group_code (from demand_groups table). */
const DEMAND_GROUP_CODES: Record<string, string> = {
  "Obst & Gemüse": "38",
  "Brot & Backwaren": "57",
  "Milchprodukte": "83",
  "Fleisch & Wurst": "68",
  "Tiefkühl": "75",
  "Getränke": "80",
  "Süßwaren & Snacks": "41",
  "Grundnahrungsmittel": "54",
  "Haushalt & Reinigung": "06",
  "Sonstiges": "AK",
};

const NOW = new Date().toISOString();

/** ALDI-typical product names by category (name only; price/ear chosen below). */
const PRODUCTS_BY_CATEGORY: Record<string, string[]> = {
  "Obst & Gemüse": [
    "Äpfel Pink Lady",
    "Äpfel Gala",
    "Bananen",
    "Zitronen",
    "Tomaten",
    "Gurke",
    "Zwiebeln",
    "Kartoffeln festkochend",
    "Paprika rot",
    "Karotten",
    "Salat Eisberg",
    "Champignons",
    "Orangen",
    "Mandarinen",
    "Erdbeeren",
    "Weintrauben",
    "Brokkoli",
    "Blumenkohl",
    "Spinat",
    "Lauch",
    "Süßkartoffeln",
    "Avocado",
    "Kirschtomaten",
    "Rucola",
    "Feldsalat",
    "Radieschen",
    "Sellerie",
    "Rote Bete",
    "Kürbis",
  ],
  "Brot & Backwaren": [
    "Vollkornbrot",
    "Toastbrot",
    "Brötchen",
    "Croissant",
    "Baguette",
    "Knäckebrot",
    "Zwieback",
    "Kekse",
    "Laugengebäck",
    "Mischbrot",
    "Graubrot",
    "Mehrkornbrot",
    "Roggenbrot",
    "Sonnenblumenkernbrot",
    "Vollkornbrötchen",
    "Schokocroissant",
    "Butterhörnchen",
  ],
  "Milchprodukte": [
    "Fettarme Milch 1,5% 1L",
    "Frische Vollmilch 3,5% 1L",
    "H-Milch 3,5% 1L",
    "Butter 250g",
    "Naturjoghurt 500g",
    "Fruchtjoghurt",
    "Gouda jung",
    "Mozzarella",
    "Frischkäse",
    "Schmand",
    "Schlagsahne",
    "Quark Magerstufe",
    "Parmesan",
    "Camembert",
    "Feta",
    "Frischmilch 1,5%",
    "Haferdrink",
    "Mandeldrink",
    "Kefir",
  ],
  "Fleisch & Wurst": [
    "Hackfleisch gemischt",
    "Hähnchenbrustfilet",
    "Putenbrust",
    "Salami",
    "Kochschinken",
    "Bratwurst",
    "Wiener",
    "Leberwurst",
    "Speck",
    "Schinken gekocht",
    "Hackfleisch Rind",
    "Nackensteak",
    "Schweinegulasch",
    "Putenschnitzel",
    "Rinderhack",
    "Bacon",
    "Mortadella",
  ],
  "Tiefkühl": [
    "Pizza Margherita",
    "Pommes frites",
    "Fischstäbchen",
    "Gemüse Mix",
    "Spinat",
    "Blätterteig",
    "Eis Vanille",
    "Eis Schokolade",
    "Lasagne",
    "Ravioli",
    "Bratkartoffeln",
    "Kräutermix",
    "Erbsen",
    "Bohnen grün",
    "Himbeeren",
    "Hähnchen Nuggets",
  ],
  "Getränke": [
    "Mineralwasser still",
    "Mineralwasser medium",
    "Apfelsaft",
    "Orangensaft",
    "Cola",
    "Cola Zero",
    "Limonade",
    "Multivitaminsaft",
    "Schorle Apfel",
    "Kaffee Bohnen",
    "Tee schwarz",
    "Tee grün",
    "Tee Kräuter",
    "Energy Drink",
    "Sportgetränk",
    "Kinderpunsch",
    "Bier Pils",
    "Rotwein",
    "Weißwein",
  ],
  "Süßwaren & Snacks": [
    "Milchschokolade",
    "Vollmilchschokolade",
    "Nuss-Nougat-Creme",
    "Gummibärchen",
    "Chips",
    "Salzstangen",
    "Schokoriegel",
    "Müsli Riegel",
    "Kekse Schoko",
    "Honig",
    "Marmelade Erdbeere",
    "Popcorn",
    "Studentenfutter",
    "Brezeln",
    "Lakritz",
    "Bonbons",
    "Marshmallows",
  ],
  "Grundnahrungsmittel": [
    "Spaghetti",
    "Penne",
    "Reis",
    "Nudeln",
    "Mehl",
    "Zucker",
    "Öl Sonnenblume",
    "Olivenöl",
    "Salz",
    "Pfeffer",
    "Brühe",
    "Tomatensauce",
    "Haferflocken",
    "Müsli",
    "Linsen",
    "Kichererbsen",
    "Bohnen weiß",
    "Konserven Tomaten",
    "Pesto",
    "Senf",
    "Ketchup",
    "Mayo",
    "Margarine",
  ],
  "Haushalt & Reinigung": [
    "Spülmittel",
    "Waschmittel",
    "Weichspüler",
    "Müllbeutel",
    "Küchenrolle",
    "Toilettenpapier",
    "Taschentücher",
    "Schwamm",
    "Allzweckreiniger",
    "Glasreiniger",
    "Bodenreiniger",
    "Spülbürste",
    "Staubsaugerbeutel",
  ],
  "Sonstiges": [
    "Batterien",
    "Kerzen",
    "Blumen",
    "Zeitung",
    "Stifte",
    "Notizblock",
  ],
};

interface ProductRow {
  product_id: string;
  name: string;
  name_normalized: string;
  demand_group_code: string;
  price: number | null;
  price_updated_at: null;
  assortment_type: "daily_range" | "special";
  availability: "national";
  region: null;
  country: string;
  special_start_date: null;
  special_end_date: null;
  status: "active";
  source: "admin";
  crowdsource_status: null;
  created_at: string;
  updated_at: string;
}

function buildProducts(): ProductRow[] {
  const rows: ProductRow[] = [];
  let idx = 0;
  for (const [categoryName, names] of Object.entries(PRODUCTS_BY_CATEGORY)) {
    const dgCode = DEMAND_GROUP_CODES[categoryName];
    if (!dgCode) continue;
    for (const name of names) {
      const productId = toUuid(`prod-import-${name}-${idx}`);
      const price = Math.round((0.49 + Math.random() * 4.5) * 100) / 100;
      rows.push({
        product_id: productId,
        name,
        name_normalized: normalize(name),
        demand_group_code: dgCode,
        price: Math.random() > 0.2 ? price : null,
        price_updated_at: null,
        assortment_type: "daily_range",
        availability: "national",
        region: null,
        country: "DE",
        special_start_date: null,
        special_end_date: null,
        status: "active",
        source: "admin",
        crowdsource_status: null,
        created_at: NOW,
        updated_at: NOW,
      });
      idx++;
    }
  }
  return rows;
}

function diagnoseEnv() {
  const pathEnv = path.resolve(process.cwd(), ".env.local");
  console.log("Lade Umgebungsvariablen aus:", pathEnv);
  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  console.log("  NEXT_PUBLIC_SUPABASE_URL:  ", url ? `${url.length} Zeichen, ${url.startsWith("https") ? "sieht ok aus" : "sollte mit https:// beginnen"}` : "FEHLT");
  console.log("  SUPABASE_SERVICE_ROLE_KEY:  ", serviceKey ? `${serviceKey.length} Zeichen, ${serviceKey.startsWith("eyJ") ? "sieht wie JWT aus" : "sollte mit eyJ beginnen (JWT)"}` : "FEHLT");
  console.log("  NEXT_PUBLIC_SUPABASE_ANON_KEY:", anonKey ? `${anonKey.length} Zeichen` : "nicht gesetzt");
  if (serviceKey && (serviceKey.includes('"') || serviceKey.includes("'"))) {
    console.warn("  Achtung: Der Key enthält Anführungszeichen – in .env.local KEINE Anführungszeichen um den Wert setzen.");
  }
}

async function main() {
  const doDiagnose = process.argv.includes("--check") || process.argv.includes("--diagnose");
  if (doDiagnose) {
    diagnoseEnv();
    return;
  }

  const url = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const serviceKey = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").trim();
  const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "").trim();
  const key = serviceKey || anonKey;
  if (!url || !key) {
    console.error("Fehler: NEXT_PUBLIC_SUPABASE_URL oder Supabase-Key fehlt in .env.local");
    console.error("Führe aus: npx tsx scripts/import-test-products.ts --check");
    console.error("dann siehst du, ob die Variablen geladen werden.");
    if (!serviceKey && anonKey) {
      console.error("Tipp: Für den Import wird SUPABASE_SERVICE_ROLE_KEY empfohlen (Supabase Dashboard → Project Settings → API).");
    }
    process.exit(1);
  }
  if (!serviceKey) {
    console.warn("Hinweis: SUPABASE_SERVICE_ROLE_KEY nicht gesetzt – verwende ANON_KEY (kann bei RLS zu Fehlern führen).");
  }

  const supabase = createClient(url, key);

  const products = buildProducts();
  console.log(`Inserting ${products.length} test products…`);

  let inserted = 0;
  let errors = 0;
  const BATCH = 50;
  for (let i = 0; i < products.length; i += BATCH) {
    const chunk = products.slice(i, i + BATCH);
    const { error } = await supabase.from("products").upsert(chunk, { onConflict: "product_id" });
    if (error) {
      console.error("Batch error:", error.message);
      errors += chunk.length;
    } else {
      inserted += chunk.length;
    }
  }

  console.log("\n--- Zusammenfassung ---");
  console.log("Importiert: ", inserted);
  console.log("Fehler:    ", errors);
}

main();
