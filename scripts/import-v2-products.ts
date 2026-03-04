/**
 * Import ALDI DE + AT products from the V2 Excel file into Supabase.
 *
 * Strategy: UPDATE existing products by article_number+country (preserves
 * product_ids and FK references). INSERT truly new products.
 *
 * Usage:
 *   npx tsx scripts/import-v2-products.ts
 *   npx tsx scripts/import-v2-products.ts --dry-run
 */

import { config } from 'dotenv';
import { resolve } from 'path';
import * as XLSX from 'xlsx';
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import {
  normalizeProductName,
  resolveImageUrl,
  extractDemandGroupCode,
} from '../src/lib/products/import-helpers';

config({ path: resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const DRY_RUN = process.argv.includes('--dry-run');
const PARALLEL_UPDATES = 20;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_KEY in .env.local');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

type ExcelRow = Record<string, unknown>;

interface ProductUpdate {
  article_number: string;
  country: string;
  name: string;
  name_normalized: string;
  ean_barcode: string | null;
  brand: string | null;
  is_private_label: boolean;
  demand_group_code: string | null;
  demand_group: string | null;
  demand_sub_group: string | null;
  assortment_type: string;
  special_start_date: string | null;
  price: number | null;
  price_updated_at: string | null;
  popularity_score: number | null;
  weight_or_quantity: string | null;
  base_price_text: string | null;
  availability_scope: string;
  availability: string;
  receipt_abbreviation: string | null;
  thumbnail_url: string | null;
}

function buildImageMap(wb: XLSX.WorkBook): Map<number, string> {
  const sheet = wb.Sheets['Product_Images_URL_DE_AT'];
  if (!sheet) return new Map();
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
  if (rows.length === 0) return new Map();
  const linkKey = Object.keys(rows[0]).find(k => k.includes('Link'))!;
  const map = new Map<number, string>();
  for (const row of rows) {
    const num = row['Article number'] as number;
    const link = row[linkKey] as string;
    if (num && link) {
      const resolved = resolveImageUrl(link);
      if (resolved && !map.has(num)) map.set(num, resolved);
    }
  }
  return map;
}

function findKey(row: ExcelRow, fragment: string): string | undefined {
  return Object.keys(row).find(k => k.includes(fragment));
}

function processSheet(
  wb: XLSX.WorkBook,
  sheetName: string,
  imageMap: Map<number, string>,
  country: string,
): ProductUpdate[] {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) { console.warn(`Sheet "${sheetName}" not found`); return []; }
  const rows: ExcelRow[] = XLSX.utils.sheet_to_json(sheet, { defval: null });
  if (rows.length === 0) return [];

  const salesKey = findKey(rows[0], 'Sales volume');
  const packKey = findKey(rows[0], 'Pack size');
  const specialDateKey = country === 'DE'
    ? 'Special start date'
    : (findKey(rows[0], 'Last Promotion') ?? 'Special start date');

  return rows.map((row) => {
    const commodityGroup = String(row['Commodity Group'] ?? '');
    const subGroup = String(row['Sub Commodity Group'] ?? '');

    let thumbnailUrl = resolveImageUrl(
      row['AEM Hypelink; Pixel size  = 1000x1000'] as string,
    );
    if (!thumbnailUrl) {
      thumbnailUrl = imageMap.get(row['Article number'] as number) ?? null;
    }

    const specialRaw = row[specialDateKey] as string | null;
    const specialDate = specialRaw && String(specialRaw).trim() !== '' ? String(specialRaw) : null;
    const salesVol = salesKey ? (row[salesKey] as number | null) : null;
    const packSize = packKey ? row[packKey] : null;

    return {
      article_number: String(row['Article number']),
      country,
      name: row['Product name'] as string,
      name_normalized: normalizeProductName(row['Product name'] as string),
      ean_barcode: row['EAN/Barcode'] ? String(row['EAN/Barcode']) : null,
      brand: (row['Brand'] as string) || null,
      is_private_label: row['Brand type'] === 'Private Label',
      demand_group_code: extractDemandGroupCode(commodityGroup),
      demand_group: commodityGroup || null,
      demand_sub_group: subGroup || null,
      assortment_type: (row['Assortment type'] as string) || 'daily_range',
      special_start_date: specialDate,
      price: (row['Latest retail price (EUR)'] as number) ?? null,
      price_updated_at: row['Price effective date']
        ? String(row['Price effective date']).trim() || null
        : null,
      popularity_score: salesVol ?? null,
      weight_or_quantity: packSize ? String(packSize) : null,
      base_price_text: (row['Base price'] as string) || null,
      availability_scope: (row['Availability scope'] as string) || 'national',
      availability: (row['Availability scope'] as string) || 'national',
      receipt_abbreviation: (row['Receipt abbreviation'] as string) || null,
      thumbnail_url: thumbnailUrl,
    };
  });
}

async function fetchExistingArticleNumbers(): Promise<Set<string>> {
  const set = new Set<string>();
  let from = 0;
  const pageSize = 1000;
  while (true) {
    const { data, error } = await supabase
      .from('products')
      .select('article_number, country')
      .eq('source', 'import')
      .not('article_number', 'is', null)
      .range(from, from + pageSize - 1);
    if (error) { console.error('Fetch error:', error.message); break; }
    if (!data || data.length === 0) break;
    for (const row of data) {
      set.add(`${row.article_number}::${row.country}`);
    }
    from += pageSize;
    if (data.length < pageSize) break;
  }
  return set;
}

async function updateProduct(p: ProductUpdate): Promise<boolean> {
  const { article_number, country, ...fields } = p;
  const { error, count } = await supabase
    .from('products')
    .update({ ...fields, source: 'import', status: 'active', updated_at: new Date().toISOString() })
    .eq('article_number', article_number)
    .eq('country', country);
  if (error) {
    console.error(`  Update error [${article_number}]: ${error.message}`);
    return false;
  }
  return true;
}

async function parallelUpdate(products: ProductUpdate[]): Promise<number> {
  let updated = 0;
  for (let i = 0; i < products.length; i += PARALLEL_UPDATES) {
    const batch = products.slice(i, i + PARALLEL_UPDATES);
    const results = await Promise.all(batch.map(updateProduct));
    updated += results.filter(Boolean).length;
    process.stdout.write(`\r  Updated: ${updated} / ${products.length}`);
  }
  console.log('');
  return updated;
}

async function batchInsert(
  products: ProductUpdate[],
  defaultCategoryId: string,
): Promise<number> {
  let inserted = 0;
  const batchSize = 50;
  for (let i = 0; i < products.length; i += batchSize) {
    const batch = products.slice(i, i + batchSize).map(p => ({
      product_id: randomUUID(),
      ...p,
      category_id: defaultCategoryId,
      source: 'import',
      status: 'active',
    }));
    const { error } = await supabase.from('products').insert(batch);
    if (error) {
      console.error(`  Insert batch error: ${error.message}`);
    } else {
      inserted += batch.length;
    }
    process.stdout.write(`\r  Inserted: ${inserted} / ${products.length}`);
  }
  console.log('');
  return inserted;
}

async function main() {
  console.log('=== ALDI V2 Product Import (Update Strategy) ===\n');
  if (DRY_RUN) console.log('[DRY RUN]\n');

  const filePath = resolve(
    process.cwd(),
    'data/raw/20260303_Shopping List Prototype_Product_Store_Data_IDA V2.xlsx',
  );
  console.log(`Reading: ${filePath}`);
  const wb = XLSX.readFile(filePath);

  console.log('Building image lookup map...');
  const imageMap = buildImageMap(wb);
  console.log(`  ${imageMap.size} image URLs loaded\n`);

  const deProducts = processSheet(wb, 'Product_Master_Data_DE_only', imageMap, 'DE');
  console.log(`DE: ${deProducts.length} (${deProducts.filter(p => p.thumbnail_url).length} with thumbnails)`);

  const atProducts = processSheet(wb, 'Product_Master_Data_AT_only', imageMap, 'AT');
  console.log(`AT: ${atProducts.length} (${atProducts.filter(p => p.thumbnail_url).length} with thumbnails)\n`);

  if (DRY_RUN) {
    const sample = deProducts.find(p => p.thumbnail_url);
    if (sample) {
      console.log('Sample product:', JSON.stringify(sample, null, 2));
    }
    console.log('\n[DRY RUN complete]');
    return;
  }

  console.log('Fetching existing article numbers...');
  const existing = await fetchExistingArticleNumbers();
  console.log(`  ${existing.size} existing products found\n`);

  const allProducts = [...deProducts, ...atProducts];
  const toUpdate = allProducts.filter(p => existing.has(`${p.article_number}::${p.country}`));
  const toInsert = allProducts.filter(p => !existing.has(`${p.article_number}::${p.country}`));

  console.log(`To update: ${toUpdate.length}`);
  console.log(`To insert: ${toInsert.length}\n`);

  console.log('Updating existing products...');
  const updatedCount = await parallelUpdate(toUpdate);

  let insertedCount = 0;
  if (toInsert.length > 0) {
    const { data: catRow } = await supabase
      .from('products')
      .select('category_id')
      .eq('source', 'import')
      .limit(1)
      .single();
    const defaultCatId = catRow?.category_id || '00000000-0000-0000-0000-000000000000';
    console.log('Inserting new products...');
    insertedCount = await batchInsert(toInsert, defaultCatId);
  }

  console.log('\n========== Summary ==========');
  console.log(`Updated: ${updatedCount}`);
  console.log(`Inserted: ${insertedCount}`);
  console.log('=============================\n');

  console.log('Verifying...');
  const { count: totalCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'import');
  const { count: thumbCount } = await supabase
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('source', 'import')
    .not('thumbnail_url', 'is', null);
  console.log(`  Total imported products: ${totalCount}`);
  console.log(`  With thumbnail_url: ${thumbCount}`);
  console.log('\nDone!');
}

main().catch(console.error);
