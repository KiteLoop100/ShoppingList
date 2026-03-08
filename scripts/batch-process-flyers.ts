/**
 * Batch-process flyer PDFs from local folders into Supabase.
 *
 * Reads .pdf files from flyers/DE or flyers/AT, splits into pages,
 * uploads to Supabase storage, extracts products via Claude + Gemini,
 * and writes flyer_page_products with bounding boxes.
 *
 * Usage:
 *   npx tsx scripts/batch-process-flyers.ts --country AT
 *   npx tsx scripts/batch-process-flyers.ts --country AT --limit 1 --dry-run
 *   npx tsx scripts/batch-process-flyers.ts --country AT --delete-existing
 *
 * Options:
 *   --country DE|AT        Which folder to process (required)
 *   --limit N              Process only the first N PDFs
 *   --dry-run              Extract data but don't write to Supabase
 *   --force                Re-process all PDFs, even if already imported
 *   --delete-existing      Delete existing flyers for this country first
 *   --delay N              Delay in ms between pages (default 5000)
 *   --claude-model NAME    Claude model (default: claude-opus-4-6)
 *   --gemini-model NAME    Gemini model (default: gemini-2.5-pro)
 *
 * Prerequisites:
 *   .env.local with ANTHROPIC_API_KEY, GOOGLE_GEMINI_API_KEY,
 *   NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */

import { config } from "dotenv";
import { resolve } from "path";
import { readdirSync, readFileSync, existsSync, writeFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import {
  callClaudeFlyer,
  detectProductBoxes,
  matchBboxesToProducts,
  processPageProducts,
  deleteExistingFlyers,
  filterNewFiles,
  FIRST_PAGE_PROMPT,
  PAGE_PROMPT,
  type FirstPageResult,
  type PageResult,
  type ProcessedEntry,
} from "./lib/flyer-import-helpers";

config({ path: resolve(process.cwd(), ".env.local") });

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY!;
const GEMINI_API_KEY = process.env.GOOGLE_GEMINI_API_KEY ?? "";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// ── CLI args ────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    country: "",
    limit: Infinity,
    dryRun: false,
    force: false,
    deleteExisting: false,
    delay: 5000,
    claudeModel: "claude-opus-4-6",
    geminiModel: "gemini-2.5-pro",
  };
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--country": opts.country = (args[++i] ?? "").toUpperCase(); break;
      case "--limit": opts.limit = parseInt(args[++i] ?? "0", 10) || Infinity; break;
      case "--dry-run": opts.dryRun = true; break;
      case "--force": opts.force = true; break;
      case "--delete-existing": opts.deleteExisting = true; break;
      case "--delay": opts.delay = parseInt(args[++i] ?? "5000", 10) || 5000; break;
      case "--claude-model": opts.claudeModel = args[++i] ?? opts.claudeModel; break;
      case "--gemini-model": opts.geminiModel = args[++i] ?? opts.geminiModel; break;
    }
  }
  return opts;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ── Main ────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  if (!opts.country || !["DE", "AT"].includes(opts.country)) {
    console.error("--country DE oder --country AT angeben");
    process.exit(1);
  }
  if (!ANTHROPIC_API_KEY) { console.error("ANTHROPIC_API_KEY fehlt in .env.local"); process.exit(1); }
  if (!SUPABASE_URL || !SUPABASE_KEY) { console.error("SUPABASE_URL/KEY fehlt"); process.exit(1); }

  const flyersDir = resolve(process.cwd(), "flyers", opts.country);
  const processedPath = resolve(flyersDir, ".processed.json");

  let allFiles: string[];
  try {
    allFiles = readdirSync(flyersDir).filter((f) => f.toLowerCase().endsWith(".pdf")).sort();
  } catch {
    console.error(`Ordner nicht gefunden: ${flyersDir}`);
    process.exit(1);
  }
  if (allFiles.length === 0) { console.error(`Keine PDFs in ${flyersDir}`); process.exit(1); }

  let processed: Record<string, ProcessedEntry> = {};
  if (existsSync(processedPath)) {
    try {
      processed = JSON.parse(readFileSync(processedPath, "utf-8"));
    } catch (e) {
      console.warn(`WARNUNG: ${processedPath} konnte nicht gelesen werden, wird neu erstellt.`);
      processed = {};
    }
  }

  if (opts.deleteExisting) {
    processed = {};
  }

  const { files: filteredFiles, skipped: skippedFiles } = filterNewFiles(allFiles, processed, opts);
  let files = filteredFiles;

  if (opts.limit < files.length) files = files.slice(0, opts.limit);

  if (files.length === 0) {
    console.log(`\n=== Batch-Handzettelverarbeitung (${opts.country}) ===\n`);
    console.log(`Ordner:       ${flyersDir}`);
    console.log(`PDFs gesamt:  ${allFiles.length}`);
    console.log(`Übersprungen: ${skippedFiles.length} (bereits verarbeitet)`);
    console.log(`Neu:          0`);
    console.log("\nKeine neuen PDFs zu verarbeiten. Nutze --force um alle erneut zu verarbeiten.");
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log(`\n=== Batch-Handzettelverarbeitung (${opts.country}) ===\n`);
  console.log(`Ordner:       ${flyersDir}`);
  console.log(`PDFs gesamt:  ${allFiles.length}`);
  if (skippedFiles.length > 0) console.log(`Übersprungen: ${skippedFiles.length} (bereits verarbeitet)`);
  console.log(`Zu verarbeiten: ${files.length}${opts.force ? " (--force)" : " (neu)"}`);
  console.log(`Claude:       ${opts.claudeModel}`);
  console.log(`Gemini:       ${opts.geminiModel}`);
  console.log(`Delay:        ${opts.delay}ms`);
  if (opts.dryRun) console.log("DRY RUN -- keine Daten werden geschrieben");
  if (!GEMINI_API_KEY) console.log("WARNUNG: GOOGLE_GEMINI_API_KEY fehlt -- keine Bounding Boxes");

  if (opts.deleteExisting && !opts.dryRun) {
    console.log(`\nLoesche bestehende ${opts.country}-Handzettel...`);
    const deleted = await deleteExistingFlyers(supabase, opts.country);
    console.log(`  ${deleted} Handzettel geloescht.\n`);
  }

  let defaultCategoryId = "00000000-0000-0000-0000-000000000000";
  if (!opts.dryRun) {
    const { data: catRow } = await supabase
      .from("products").select("category_id")
      .eq("demand_group_code", "AK").limit(1).single();
    if (catRow?.category_id) defaultCategoryId = catRow.category_id;
  }

  let totalCreated = 0, totalUpdated = 0, totalPages = 0, totalErrors = 0;

  for (const file of files) {
    const filePath = resolve(flyersDir, file);
    console.log(`\n--- ${file} ---`);

    const pdfBytes = readFileSync(filePath);
    const sourceDoc = await PDFDocument.load(pdfBytes);
    const pageCount = sourceDoc.getPageCount();
    console.log(`  ${pageCount} Seiten`);

    const today = new Date().toISOString().slice(0, 10);
    let flyerId = "dry-run";
    let flyerCountry = opts.country;
    let validFrom = today;
    let validTo = today;

    if (!opts.dryRun) {
      const { data: flyerRow, error } = await supabase.from("flyers").insert({
        title: file, valid_from: today, valid_until: today,
        country: opts.country, pdf_url: null, total_pages: pageCount,
        status: "active", created_at: new Date().toISOString(),
      }).select("flyer_id").single();
      if (error || !flyerRow) { console.error("  Flyer-Insert fehlgeschlagen:", error?.message); totalErrors++; continue; }
      flyerId = flyerRow.flyer_id;

      for (let n = 1; n <= pageCount; n++) {
        const pageDoc = await PDFDocument.create();
        const [page] = await pageDoc.copyPages(sourceDoc, [n - 1]);
        pageDoc.addPage(page);
        const pagePdfBytes = await pageDoc.save();
        const path = `${flyerId}/page-${n}.pdf`;
        const { error: upErr } = await supabase.storage
          .from("flyer-pages").upload(path, pagePdfBytes, { contentType: "application/pdf", upsert: true });
        if (upErr) { console.warn(`  Upload page ${n} failed:`, upErr.message); continue; }
        const { data: urlData } = supabase.storage.from("flyer-pages").getPublicUrl(path);
        await supabase.from("flyer_pages").insert({
          flyer_id: flyerId, page_number: n, image_url: urlData.publicUrl,
        });
      }
      console.log(`  Seiten hochgeladen.`);
    }

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const start = Date.now();
      const pageDoc = await PDFDocument.create();
      const [page] = await pageDoc.copyPages(sourceDoc, [pageNum - 1]);
      pageDoc.addPage(page);
      const pagePdfBytes = await pageDoc.save();
      const pageBase64 = Buffer.from(pagePdfBytes).toString("base64");

      const isFirstPage = pageNum === 1;
      const prompt = isFirstPage ? FIRST_PAGE_PROMPT : PAGE_PROMPT;

      try {
        const [claudeResult, geminiBoxes] = await Promise.all([
          callClaudeFlyer<FirstPageResult | PageResult>(pageBase64, prompt, opts.claudeModel, ANTHROPIC_API_KEY),
          detectProductBoxes(pageBase64, opts.geminiModel, GEMINI_API_KEY),
        ]);

        const products = claudeResult.products ?? [];
        const productNames = products.map((p) => (p.name || "").trim()).filter(Boolean);
        const bboxMap = matchBboxesToProducts(geminiBoxes, productNames);
        const elapsed = ((Date.now() - start) / 1000).toFixed(1);

        if (isFirstPage && !opts.dryRun) {
          const fp = claudeResult as FirstPageResult;
          validFrom = fp.special_valid_from ?? today;
          validTo = fp.special_valid_to ?? validFrom;
          const title = (fp.flyer_title ?? `Angebote ab ${validFrom.slice(8, 10)}.${validFrom.slice(5, 7)}.`).trim();
          const detectedCountry = fp.detected_country;
          if (detectedCountry === "AT") flyerCountry = "AT";
          else if (detectedCountry === "DE") flyerCountry = "DE";

          await supabase.from("flyers").update({
            title, valid_from: validFrom, valid_until: validTo, country: flyerCountry,
            status: validTo < today ? "expired" : "active",
          }).eq("flyer_id", flyerId);
        }

        if (!opts.dryRun) {
          const { created, updated } = await processPageProducts(
            supabase, products, flyerId, pageNum, bboxMap, flyerCountry, validFrom, validTo, defaultCategoryId,
          );
          totalCreated += created;
          totalUpdated += updated;
          console.log(`  Seite ${String(pageNum).padStart(2)}/${pageCount}: ${products.length} Produkte, ${bboxMap.size} Bboxes, +${created} ~${updated} [${elapsed}s]`);
        } else {
          console.log(`  Seite ${String(pageNum).padStart(2)}/${pageCount}: ${products.length} Produkte, ${bboxMap.size} Bboxes [${elapsed}s] (dry-run)`);
        }

        totalPages++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error(`  Seite ${String(pageNum).padStart(2)}/${pageCount}: FEHLER - ${msg.slice(0, 120)}`);
        totalErrors++;
      }

      if (pageNum < pageCount) await sleep(opts.delay);
    }

    // Track successfully processed file
    if (!opts.dryRun && flyerId !== "dry-run") {
      processed[file] = { flyerId, processedAt: new Date().toISOString() };
      writeFileSync(processedPath, JSON.stringify(processed, null, 2), "utf-8");
    }
  }

  console.log("\n=== Zusammenfassung ===");
  console.log(`Seiten verarbeitet:    ${totalPages}`);
  console.log(`Produkte erstellt:     ${totalCreated}`);
  console.log(`Produkte aktualisiert: ${totalUpdated}`);
  console.log(`Fehler:                ${totalErrors}`);
  if (opts.dryRun) console.log("\nDRY RUN -- keine Daten wurden geschrieben.");
  console.log("");
}

main().catch((e) => {
  console.error("\nUnerwarteter Fehler:", e);
  process.exit(1);
});
