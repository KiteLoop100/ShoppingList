/**
 * Setzt die Einkaufsreihenfolge (Level 1: Demand Groups, Level 2: Sub-Groups)
 * für den ALDI SÜD München-Bogenhausen, Richard-Strauß-Straße.
 *
 * Liest die Konfiguration aus store-layout-richard-strauss.json.
 * Reihenfolge dort ändern, dann dieses Script erneut ausführen.
 *
 * Voraussetzungen:
 *   .env.local mit NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY
 *
 * Nutzung:
 *   npx tsx scripts/set-store-layout-munich-richard-strauss.ts
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

config({ path: resolve(process.cwd(), ".env.local") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Alle DE-Demand-Groups als Fallback für nicht explizit gelistete Gruppen
const ALL_DE_DEMAND_GROUPS: string[] = [
  "AK-Aktionsartikel",
  "01-Spirituosen",
  "02-Sekt/Schaumwein",
  "03-Wein",
  "04-Bier",
  "05-Wasser",
  "06-Wasch-/Putz-/Reinigungsmittel",
  "07-Kosmetik/Körperpflege",
  "08-Körperhygiene",
  "09-Babyartikel",
  "10-Papierwaren",
  "11-Folien/Tücher",
  "12-Audio/Video/Batterien",
  "13-Apothekenprodukte",
  "14-Kinder-Textilien",
  "15-Herren-Textilien",
  "16-Damen-Textilien",
  "17-Sport & Sportbekleidung",
  "18-Heimtextilien",
  "19-Möbel",
  "20-Unterhaltungselektronik",
  "22-Heimwerkerbedarf",
  "25-Haushaltsartikel",
  "27-Pflanzen/Blumen",
  "28-Schreibwaren/Büroartikel/Papeterie",
  "29-Deko-Artikel",
  "30-Koffer/Taschen",
  "31-Gartenbedarf",
  "32-Spielwaren",
  "33-Auto/Motorrad/Fahrrad",
  "34-Sport/Camping/Freizeit",
  "35-Haushaltsgeräte",
  "36-Schuhe",
  "38-Gemüse",
  "40-Bonbons/Kaugummi",
  "41-Schokolade/Pralinen",
  "42-Gebäck",
  "43-Saisonartikel Süßwaren",
  "44-Salzgebäck",
  "45-Kaffee/Kakao",
  "46-Tee",
  "47-Konserven",
  "48-Fertiggerichte/Suppen",
  "49-Dauerwurst/Speck",
  "50-H-Milchprodukte/Milchersatzprodukte",
  "51-Joghurts/Quark",
  "52-Dressings/Öle/Soßen",
  "53-Konfitüren/Brotaufstriche",
  "54-Nährmittel",
  "55-Eier",
  "56-Bake-Off",
  "57-Brot/Kuchen",
  "58-Obst",
  "59-Tabakwaren",
  "60-Margarine/pflanzliche Fette",
  "62-Frischfleisch (ohne Schwein/Geflügel)",
  "63-Geschenkkarten/Gutscheine/Tickets/Coupon",
  "64-Fisch, frisch",
  "67-Geflügel, frisch",
  "68-Schweinefleisch, frisch",
  "69-Gekühlte Wurstwaren",
  "70-Gekühltes verzehrfertiges Fleisch/Fleisc",
  "71-Gekühlter verzehrfertiger Fisch",
  "72-Gekühlte Fertiggerichte",
  "73-Gekühlte Feinkost",
  "74-Gekühlte Getränke",
  "75-TK Fleisch/Fisch",
  "76-TK Obst/Gemüse",
  "77-TK Desserts/Backwaren/Eis",
  "78-TK Fertiggerichte/Pizzas",
  "79-Funktionsgetränke/Eistee",
  "80-CO2 Erfrischungsgetränke",
  "81-Fruchtsäfte/Sirupe",
  "82-Wurst-/Fleisch-/Fischkonserven",
  "83-Milch/Sahne/Butter",
  "84-Käse/Käseersatzprodukte",
  "85-Tiernahrung",
  "86-Chips/Snacks",
  "87-Nüsse/Trockenfrüchte",
  "88-Salate",
  "89-Backartikel",
  "90-Cerealien/Snacks",
  "92-Beleuchtung",
  "93-ALDI Services",
];

interface LayoutConfig {
  store_match: { city_pattern: string; address_pattern: string };
  group_order: string[];
  subgroup_order: Record<string, string[]>;
}

type PairwiseRow = {
  store_id: string;
  level: string;
  scope: string | null;
  item_a: string;
  item_b: string;
  a_before_b_count: number;
  b_before_a_count: number;
  last_updated_at: string;
};

/** Vollständige Reihenfolge: explizite Liste + restliche Gruppen dahinter. */
function buildFullGroupOrder(explicitOrder: string[]): string[] {
  const seen = new Set<string>();
  const order: string[] = [];
  for (const g of explicitOrder) {
    if (!seen.has(g)) { seen.add(g); order.push(g); }
  }
  for (const g of ALL_DE_DEMAND_GROUPS) {
    if (!seen.has(g)) { seen.add(g); order.push(g); }
  }
  return order;
}

/** Für jedes Paar (A vor B) eine Zeile mit item_a < item_b erzeugen. */
function generatePairwiseRows(
  storeId: string,
  level: string,
  scope: string | null,
  order: string[]
): PairwiseRow[] {
  const rows: PairwiseRow[] = [];
  const now = new Date().toISOString();
  for (let i = 0; i < order.length; i++) {
    for (let j = i + 1; j < order.length; j++) {
      const a = order[i];
      const b = order[j];
      const [item_a, item_b] = a < b ? [a, b] : [b, a];
      rows.push({
        store_id: storeId,
        level,
        scope,
        item_a,
        item_b,
        a_before_b_count: a < b ? 1 : 0,
        b_before_a_count: a < b ? 0 : 1,
        last_updated_at: now,
      });
    }
  }
  return rows;
}

async function main() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("NEXT_PUBLIC_SUPABASE_URL und SUPABASE_SERVICE_ROLE_KEY in .env.local erforderlich.");
    process.exit(1);
  }

  // JSON-Konfiguration einlesen
  const configPath = resolve(process.cwd(), "scripts/store-layout-richard-strauss.json");
  let layoutConfig: LayoutConfig;
  try {
    layoutConfig = JSON.parse(readFileSync(configPath, "utf-8")) as LayoutConfig;
  } catch (e) {
    console.error("Fehler beim Lesen der Konfigurationsdatei:", configPath, e);
    process.exit(1);
  }
  console.log("Konfiguration geladen:", configPath);
  console.log("  group_order Einträge:", layoutConfig.group_order.length);
  console.log("  subgroup_order Gruppen:", Object.keys(layoutConfig.subgroup_order).length);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Store finden
  const { city_pattern, address_pattern } = layoutConfig.store_match;
  const { data: stores, error: storeError } = await supabase
    .from("stores")
    .select("store_id, name, city, address")
    .ilike("city", `%${city_pattern}%`);

  if (storeError) {
    console.error("Fehler beim Laden der Stores:", storeError);
    process.exit(1);
  }

  const store = (stores ?? []).find((s) =>
    new RegExp(address_pattern, "i").test(s.address ?? "") ||
    new RegExp(address_pattern, "i").test(s.name ?? "")
  );

  if (!store) {
    console.error(`Store mit city='${city_pattern}' und address='${address_pattern}' nicht gefunden.`);
    console.error("Gefundene Stores:");
    (stores ?? []).forEach((s) => console.error(" ", s.name, "|", s.address));
    process.exit(1);
  }
  console.log(`\nStore: ${store.name} | ${store.address} | ${store.store_id}`);

  // --- Level 1: Demand Groups ---
  const fullGroupOrder = buildFullGroupOrder(layoutConfig.group_order);
  console.log(`\nLevel 1 (group): ${fullGroupOrder.length} Gruppen, ${layoutConfig.group_order.length} explizit geordnet.`);

  const groupRows = generatePairwiseRows(store.store_id, "group", null, fullGroupOrder);
  console.log(`  → ${groupRows.length} pairwise Zeilen`);

  const { error: delGroupError } = await supabase
    .from("pairwise_comparisons")
    .delete()
    .eq("store_id", store.store_id)
    .eq("level", "group");
  if (delGroupError) { console.error("Fehler beim Löschen (group):", delGroupError); process.exit(1); }

  // In Batches von 500 einfügen (Supabase-Limit)
  for (let i = 0; i < groupRows.length; i += 500) {
    const batch = groupRows.slice(i, i + 500);
    const { error } = await supabase.from("pairwise_comparisons").insert(batch);
    if (error) { console.error(`Fehler beim Einfügen (group, Batch ${i / 500 + 1}):`, error); process.exit(1); }
  }
  console.log("  ✓ Level 1 geschrieben.");

  // --- Level 2: Sub-Groups ---
  const subgroupEntries = Object.entries(layoutConfig.subgroup_order);
  console.log(`\nLevel 2 (subgroup): ${subgroupEntries.length} Gruppen mit Sub-Group-Reihenfolge.`);

  const { error: delSubError } = await supabase
    .from("pairwise_comparisons")
    .delete()
    .eq("store_id", store.store_id)
    .eq("level", "subgroup");
  if (delSubError) { console.error("Fehler beim Löschen (subgroup):", delSubError); process.exit(1); }

  let totalSubRows = 0;
  for (const [group, subOrder] of subgroupEntries) {
    if (subOrder.length < 2) continue;
    const rows = generatePairwiseRows(store.store_id, "subgroup", group, subOrder);
    totalSubRows += rows.length;
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase.from("pairwise_comparisons").insert(batch);
      if (error) { console.error(`Fehler beim Einfügen (subgroup, ${group}):`, error); process.exit(1); }
    }
  }
  console.log(`  → ${totalSubRows} pairwise Zeilen`);
  console.log("  ✓ Level 2 geschrieben.");

  console.log(`\n✅ Reihenfolge für "${store.name}" erfolgreich gesetzt.`);
  console.log("   Die gesetzte Reihenfolge gilt zu 100% bis zum ersten echten Einkauf in diesem Store.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
