/**
 * Reprocess all flyers via the local dev server API.
 * Calls /api/process-flyer-page for each unprocessed page sequentially.
 *
 * Usage: node scripts/reprocess-all-flyers.mjs
 */

const BASE = "https://localhost:3000";
const DELAY_MS = 3000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 15000;

// TLS bypass removed for security -- use proper certificates

const FLYERS = [
  { flyer_id: "42c7f7ce-ac34-4b39-85c4-c1946d966887", upload_id: "463a4938-4bfa-43fc-9cd7-02d7468547eb", title: "KW 09 - Mo. 2.3. (DE)", total_pages: 23 },
  { flyer_id: "2656a424-e93e-450f-8baf-6ee1d9a568a9", upload_id: "c90fd3ea-5928-43f3-beea-f3208284ddcf", title: "KW 10 - ab 09.03. (DE)", total_pages: 26 },
  { flyer_id: "edb55f2b-ab9d-4d87-99c1-cee79b3c959b", upload_id: "c5fb4c5c-f456-4a49-a9c5-0eebe4ff6e11", title: "Flugblatt KW 08 (AT)", total_pages: 37 },
  { flyer_id: "066ea37a-30f0-43ae-a937-d966e2d6dfe8", upload_id: "05cdbcf8-5b56-44bf-9c90-6abe9e5e3375", title: "AB MO. 16.2. (AT)", total_pages: 41 },
  { flyer_id: "b581700b-5356-4725-8210-b363a517eceb", upload_id: "ddaf8660-5b03-4159-afd9-34a9fcb605ad", title: "KW 08 - ab 16.02. (DE)", total_pages: 37 },
  { flyer_id: "3a691f31-2e4d-465f-a3bb-9137ee3aed19", upload_id: "f989c23a-ea7d-421a-b9cd-d13e8c48f0f0", title: "KW 09 - ab 23.02. (DE)", total_pages: 38 },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function processPage(flyer, pageNumber, attempt = 1) {
  try {
    const res = await fetch(`${BASE}/api/process-flyer-page`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        upload_id: flyer.upload_id,
        flyer_id: flyer.flyer_id,
        page_number: pageNumber,
      }),
    });

    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      if (attempt < MAX_RETRIES) {
        console.log(`    -> Non-JSON response, retry ${attempt}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
        return processPage(flyer, pageNumber, attempt + 1);
      }
      return { ok: false, error: `Non-JSON: ${text.slice(0, 100)}` };
    }

    if (!res.ok) {
      if (attempt < MAX_RETRIES && (res.status === 429 || res.status >= 500)) {
        console.log(`    -> ${res.status} error, retry ${attempt}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s...`);
        await sleep(RETRY_DELAY_MS);
        return processPage(flyer, pageNumber, attempt + 1);
      }
      return { ok: false, error: data.error || `HTTP ${res.status}` };
    }

    return { ok: true, ...data };
  } catch (e) {
    if (attempt < MAX_RETRIES) {
      console.log(`    -> Network error, retry ${attempt}/${MAX_RETRIES} in ${RETRY_DELAY_MS / 1000}s...`);
      await sleep(RETRY_DELAY_MS);
      return processPage(flyer, pageNumber, attempt + 1);
    }
    return { ok: false, error: e.message };
  }
}

async function main() {
  const totalAllPages = FLYERS.reduce((s, f) => s + f.total_pages, 0);
  let totalProcessed = 0;
  let totalProducts = 0;
  let errors = 0;

  console.log(`\n=== Reprocessing ${FLYERS.length} flyers (${totalAllPages} pages total) ===`);
  console.log(`    Delay between pages: ${DELAY_MS / 1000}s, retries: ${MAX_RETRIES}\n`);

  for (const flyer of FLYERS) {
    console.log(`\n--- ${flyer.title} (${flyer.total_pages} pages) ---`);

    for (let page = 1; page <= flyer.total_pages; page++) {
      const start = Date.now();
      const result = await processPage(flyer, page);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);

      if (result.ok) {
        const created = result.products_created || 0;
        const updated = result.products_updated || 0;
        const skipped = result.skipped ? " (skipped)" : "";
        totalProcessed++;
        totalProducts += created + updated;
        console.log(
          `  Page ${String(page).padStart(2)}/${flyer.total_pages}: +${created} ~${updated} [${elapsed}s]${skipped}`
        );
      } else {
        errors++;
        console.error(`  Page ${String(page).padStart(2)}/${flyer.total_pages}: ERROR - ${result.error} [${elapsed}s]`);
      }

      if (page < flyer.total_pages) await sleep(DELAY_MS);
    }
  }

  console.log(`\n=== Done: ${totalProcessed} pages, ${totalProducts} products, ${errors} errors ===\n`);
}

main().catch(console.error);
