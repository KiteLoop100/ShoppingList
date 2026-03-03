/**
 * Import Hofer (ALDI AT) products from Excel into Supabase
 * 
 * Usage:
 *   1. Place hofer_produkte_470_bereinigt.xlsx in the project root or scripts/ folder
 *   2. Run: npx tsx scripts/import-hofer-products.ts
 * 
 * Prerequisites:
 *   npm install xlsx dotenv --save-dev  (if not already installed)
 *   .env.local must contain NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or NEXT_PUBLIC_SUPABASE_ANON_KEY)
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

// Load env
config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Mapping: Hofer "Kategorie" → App category name
// This maps the 26 Hofer categories to consolidated app categories
const CATEGORY_MAP: Record<string, string> = {
  'Obst & Gemüse': 'Obst & Gemüse',
  'Milchprodukte': 'Milchprodukte',
  'Käse': 'Käse',
  'Wurst & Aufschnitt': 'Wurst & Aufschnitt',
  'Salami & Snacks': 'Wurst & Aufschnitt',
  'Frischfleisch': 'Fleisch & Geflügel',
  'Fisch & Meeresfrüchte': 'Fisch & Meeresfrüchte',
  'Getränke': 'Getränke',
  'Kaffee & Tee': 'Kaffee & Tee',
  'Frühstück & Cerealien': 'Frühstück & Cerealien',
  'Pasta & Reis': 'Grundnahrungsmittel',
  'Gewürze & Würzmittel': 'Gewürze & Saucen',
  'Saucen & Dressings': 'Gewürze & Saucen',
  'World Food & Konserven': 'Konserven & Fertiggerichte',
  'Fertiggerichte': 'Konserven & Fertiggerichte',
  'Feinkost & Delikatessen': 'Feinkost',
  'Süßwaren & Snacks': 'Süßwaren & Snacks',
  'Süßwaren / Backzutaten': 'Süßwaren & Snacks',
  'Wein': 'Wein & Spirituosen',
  'Spirituosen': 'Wein & Spirituosen',
  'Drogerie & Körperpflege': 'Drogerie & Körperpflege',
  'Hygieneartikel': 'Drogerie & Körperpflege',
  'Waschmittel & Reinigung': 'Waschmittel & Reinigung',
  'Papierprodukte & Haushalt': 'Haushalt & Papier',
  'Haushalt & Küche': 'Haushalt & Papier',
  'Tierbedarf': 'Tierbedarf',
};

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[äÄ]/g, 'ae')
    .replace(/[öÖ]/g, 'oe')
    .replace(/[üÜ]/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9\s]/g, '')
    .trim();
}

/** Map Hofer category name to demand_group_code (from demand_groups table). */
const DEMAND_GROUP_MAP: Record<string, string> = {
  'Obst & Gemüse': '38',
  'Milchprodukte': '83',
  'Käse': '84',
  'Wurst & Aufschnitt': '69',
  'Fleisch & Geflügel': '67',
  'Fisch & Meeresfrüchte': '64',
  'Getränke': '80',
  'Kaffee & Tee': '45',
  'Frühstück & Cerealien': '90',
  'Grundnahrungsmittel': '54',
  'Gewürze & Saucen': '52',
  'Konserven & Fertiggerichte': '47',
  'Feinkost': '73',
  'Süßwaren & Snacks': '41',
  'Wein & Spirituosen': '03',
  'Drogerie & Körperpflege': '07',
  'Waschmittel & Reinigung': '06',
  'Haushalt & Papier': '25',
  'Tierbedarf': '85',
  'Sonstiges': 'AK',
};

interface HoferRow {
  '#': number;
  'Produktname': string;
  'Marke': string;
  'Eigenmarke': string;
  'Kategorie': string;
  'Unterkategorie': string;
  'Preis (€)': number | null;
  'Einheit': string;
  'Verpackung': string;
  'Abteilung': string;
  'Bemerkung': string;
}

async function main() {
  console.log('🛒 Hofer Product Import\n');

  // Try to find the Excel file
  const possiblePaths = [
    resolve(process.cwd(), 'hofer_produkte_470_bereinigt.xlsx'),
    resolve(process.cwd(), 'scripts', 'hofer_produkte_470_bereinigt.xlsx'),
    resolve(process.cwd(), 'data', 'hofer_produkte_470_bereinigt.xlsx'),
  ];

  let filePath = '';
  for (const p of possiblePaths) {
    try {
      const fs = await import('fs');
      if (fs.existsSync(p)) {
        filePath = p;
        break;
      }
    } catch {}
  }

  if (!filePath) {
    console.error('❌ Excel file not found. Place hofer_produkte_470_bereinigt.xlsx in project root, scripts/ or data/ folder.');
    process.exit(1);
  }

  console.log(`📄 Reading: ${filePath}`);
  const workbook = XLSX.readFile(filePath);
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json<HoferRow>(sheet);
  console.log(`   ${rows.length} products found\n`);

  // Optional: Clear existing Hofer products (source = 'import' and country = 'AT')
  const { error: deleteError } = await supabase
    .from('products')
    .delete()
    .eq('source', 'import')
    .eq('country', 'AT');

  if (deleteError) {
    console.log(`⚠️  Could not clear old imports: ${deleteError.message}`);
  } else {
    console.log('🗑️  Cleared previous Hofer imports\n');
  }

  // Build products
  let imported = 0;
  let skipped = 0;
  let errors = 0;

  const products = rows.map((row) => {
    const appCategory = CATEGORY_MAP[row['Kategorie']] || 'Sonstiges';
    const demandGroupCode = DEMAND_GROUP_MAP[appCategory] || 'AK';
    const isEigenmarke = row['Eigenmarke'] === 'Ja';

    return {
      product_id: randomUUID(),
      name: row['Produktname'],
      name_normalized: normalize(row['Produktname']),
      brand: row['Marke'] || null,
      demand_group_code: demandGroupCode,
      demand_group: row['Kategorie'],
      demand_sub_group: row['Unterkategorie'],
      price: row['Preis (€)'] || null,
      price_updated_at: row['Preis (€)'] ? new Date().toISOString() : null,
      assortment_type: 'daily_range',
      availability: 'national',
      region: null,
      country: 'AT',                             // Austria
      special_start_date: null,
      special_end_date: null,
      status: 'active',
      source: 'import',
      crowdsource_status: null,
      article_number: null,
      ean_barcode: null,
      popularity_score: null,
    };
  });

  // Batch insert (50 at a time)
  const BATCH_SIZE = 50;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    const { error } = await supabase.from('products').insert(batch);
    if (error) {
      console.error(`❌ Batch ${i / BATCH_SIZE + 1}: ${error.message}`);
      errors += batch.length;
    } else {
      imported += batch.length;
      process.stdout.write(`\r   Imported: ${imported} / ${products.length}`);
    }
  }

  console.log('\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`✅ Imported:  ${imported}`);
  console.log(`⏭️  Skipped:   ${skipped}`);
  console.log(`❌ Errors:    ${errors}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  console.log('\n🎉 Done!');
}

main().catch(console.error);
