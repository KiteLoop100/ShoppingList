/**
 * PDF flyer processing: split pages, Claude extraction, product upsert (BL-31).
 */

import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { PDFDocument } from "pdf-lib";
import { callClaudeJSON } from "@/lib/api/claude-client";
import { CLAUDE_MODEL_SONNET } from "@/lib/api/config";
import { loadDemandGroups, loadDemandSubGroups, buildDemandGroupsAndSubGroupsPrompt } from "@/lib/categories/constants";
import {
  PDF_PAGES_INITIAL_MAX,
  buildFlyerPdfFirstPagePrompt,
  buildFlyerPdfPagePrompt,
  type ClaudeResponse,
  type ExtractedProductWithPage,
} from "./prompts";
import {
  detectProductBoxes,
  matchBboxesToProducts,
} from "./gemini-detect";
import { upsertExtractedProducts } from "./process-receipt";
import { log } from "@/lib/utils/logger";

async function callClaudeWithPdf(
  pdfBase64: string,
  prompt: string,
): Promise<ClaudeResponse> {
  return callClaudeJSON<ClaudeResponse>({
    model: CLAUDE_MODEL_SONNET,
    max_tokens: 16384,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBase64,
            },
          },
          { type: "text", text: prompt },
        ],
      },
    ],
  });
}

export async function processFlyer(
  supabase: SupabaseClient,
  uploadId: string,
  photoUrl: string,
  pdfBuf: ArrayBuffer,
  now: string,
): Promise<NextResponse> {
  try {
    const pdfBytes = new Uint8Array(pdfBuf);
    const [sourceDoc, groups, subGroups] = await Promise.all([
      PDFDocument.load(pdfBytes),
      loadDemandGroups(supabase),
      loadDemandSubGroups(supabase),
    ]);
    const demandGroupsBlock = buildDemandGroupsAndSubGroupsPrompt(groups, subGroups);
    const FLYER_PDF_FIRST_PAGE_PROMPT = buildFlyerPdfFirstPagePrompt(demandGroupsBlock);
    const FLYER_PDF_PAGE_PROMPT = buildFlyerPdfPagePrompt(demandGroupsBlock);

    const totalPages = sourceDoc.getPageCount();
    log.debug("[process-photo] Flyer PDF: total pages:", totalPages);

    const today = new Date().toISOString().slice(0, 10);
    const { data: flyerRow, error: flyerErr } = await supabase
      .from("flyers")
      .insert({
        title: "Handzettel",
        valid_from: today,
        valid_until: today,
        country: "DE",
        pdf_url: photoUrl,
        total_pages: totalPages,
        status: "active",
        created_at: now,
      })
      .select("flyer_id")
      .single();

    if (flyerErr || !flyerRow) {
      log.error("[process-photo] Flyer insert failed:", flyerErr?.message);
      await supabase
        .from("photo_uploads")
        .update({
          status: "error",
          error_message: "Flyer anlegen fehlgeschlagen",
          processed_at: now,
        })
        .eq("upload_id", uploadId);
      return NextResponse.json(
        { error: "Failed to create flyer" },
        { status: 502 },
      );
    }
    const flyerId = flyerRow.flyer_id as string;

    for (let n = 1; n <= totalPages; n++) {
      const pageDoc = await PDFDocument.create();
      const [page] = await pageDoc.copyPages(sourceDoc, [n - 1]);
      pageDoc.addPage(page);
      const pagePdfBytes = await pageDoc.save();
      const path = `${flyerId}/page-${n}.pdf`;
      const { error: upErr } = await supabase.storage
        .from("flyer-pages")
        .upload(path, pagePdfBytes, {
          contentType: "application/pdf",
          upsert: true,
        });
      if (upErr) {
        log.warn("[process-photo] Flyer page PDF upload failed:", upErr.message);
      } else {
        const { data: urlData } = supabase.storage
          .from("flyer-pages")
          .getPublicUrl(path);
        await supabase.from("flyer_pages").insert({
          flyer_id: flyerId,
          page_number: n,
          image_url: urlData.publicUrl,
        });
      }
    }

    let validFrom = today;
    let validUntil = today;
    let title = "Handzettel";
    let flyerCountry = "DE";
    let flyerCountryUncertain = false;
    const allProducts: ExtractedProductWithPage[] = [];
    const pagesToProcessInInitial = Math.min(
      totalPages,
      PDF_PAGES_INITIAL_MAX,
    );

    const firstPageDoc = await PDFDocument.create();
    const [firstPage] = await firstPageDoc.copyPages(sourceDoc, [0]);
    firstPageDoc.addPage(firstPage);
    const firstPagePdfBytes = await firstPageDoc.save();
    const firstPageBase64 =
      Buffer.from(firstPagePdfBytes).toString("base64");

    const [firstGeminiResult, firstResponse] = await Promise.all([
      detectProductBoxes(firstPageBase64).catch(() => []),
      callClaudeWithPdf(firstPageBase64, FLYER_PDF_FIRST_PAGE_PROMPT),
    ]);

    validFrom = firstResponse.special_valid_from ?? today;
    validUntil = firstResponse.special_valid_to ?? validFrom;
    title = (
      firstResponse.flyer_title ??
      "Angebote ab " +
        validFrom.slice(8, 10) +
        "." +
        validFrom.slice(5, 7) +
        "."
    ).trim();

    const rawCountry = (firstResponse as Record<string, unknown>)
      .detected_country;
    if (rawCountry === "AT") {
      flyerCountry = "AT";
    } else if (rawCountry === "DE") {
      flyerCountry = "DE";
    } else {
      flyerCountry = "DE";
      flyerCountryUncertain = true;
    }
    log.debug(
      "[process-photo] Flyer detected_country:",
      rawCountry,
      "→ flyerCountry:",
      flyerCountry,
      "uncertain:",
      flyerCountryUncertain,
    );

    const { data: existingFlyer } = await supabase
      .from("flyers")
      .select("flyer_id")
      .eq("valid_from", validFrom)
      .eq("valid_until", validUntil)
      .eq("total_pages", totalPages)
      .eq("country", flyerCountry)
      .neq("flyer_id", flyerId)
      .limit(1);
    if (existingFlyer?.length) {
      log.warn("[process-photo] Duplicate flyer detected, cleaning up:", flyerId);
      await supabase.from("flyer_pages").delete().eq("flyer_id", flyerId);
      await supabase.from("flyers").delete().eq("flyer_id", flyerId);
      await supabase
        .from("photo_uploads")
        .update({ status: "error", error_message: "Handzettel existiert bereits", processed_at: now })
        .eq("upload_id", uploadId);
      return NextResponse.json(
        { error: "Duplicate flyer", existing_flyer_id: existingFlyer[0].flyer_id },
        { status: 409 },
      );
    }

    await supabase
      .from("flyers")
      .update({
        title,
        valid_from: validFrom,
        valid_until: validUntil,
        country: flyerCountry,
        status: validUntil < today ? "expired" : "active",
      })
      .eq("flyer_id", flyerId);

    const firstPageProducts = firstResponse.products ?? [];
    const firstBboxMap = matchBboxesToProducts(
      firstGeminiResult,
      firstPageProducts.map((p) => (p.name || "").trim()).filter(Boolean),
    );
    firstPageProducts.forEach((p) => {
      const bbox = firstBboxMap.get((p.name || "").trim()) ?? null;
      allProducts.push({ ...p, bbox, flyer_page: 1 });
    });

    await supabase
      .from("photo_uploads")
      .update({
        extracted_data: {
          flyer_id: flyerId,
          total_pages: totalPages,
          pages_processed: 1,
          flyer_title: title,
          special_valid_from: validFrom,
          special_valid_to: validUntil,
        } as unknown as Record<string, unknown>,
      })
      .eq("upload_id", uploadId);

    for (let pageNum = 2; pageNum <= pagesToProcessInInitial; pageNum++) {
      const pageDoc = await PDFDocument.create();
      const [page] = await pageDoc.copyPages(sourceDoc, [pageNum - 1]);
      pageDoc.addPage(page);
      const pagePdfBytes = await pageDoc.save();
      const pageBase64 = Buffer.from(pagePdfBytes).toString("base64");

      const [pageGeminiResult, pageResponse] = await Promise.all([
        detectProductBoxes(pageBase64).catch(() => []),
        callClaudeWithPdf(pageBase64, FLYER_PDF_PAGE_PROMPT),
      ]);

      const pageProducts = pageResponse.products ?? [];
      const pageBboxMap = matchBboxesToProducts(
        pageGeminiResult,
        pageProducts.map((p) => (p.name || "").trim()).filter(Boolean),
      );
      pageProducts.forEach((p) => {
        const bbox = pageBboxMap.get((p.name || "").trim()) ?? null;
        allProducts.push({ ...p, bbox, flyer_page: pageNum });
      });

      await supabase
        .from("photo_uploads")
        .update({
          extracted_data: {
            flyer_id: flyerId,
            total_pages: totalPages,
            pages_processed: pageNum,
            flyer_title: title,
            special_valid_from: validFrom,
            special_valid_to: validUntil,
          } as unknown as Record<string, unknown>,
        })
        .eq("upload_id", uploadId);
    }

    const claudeJson: ClaudeResponse = {
      photo_type: "flyer_pdf",
      products: allProducts,
      special_valid_from: validFrom,
      special_valid_to: validUntil,
    };

    log.debug(
      "[process-photo] Flyer PDF initial: flyer_id:",
      flyerId,
      "pages processed:",
      pagesToProcessInInitial,
      "products so far:",
      allProducts.length,
    );

    const flyerRemainingPages =
      totalPages > PDF_PAGES_INITIAL_MAX
        ? {
            flyer_id: flyerId,
            total_pages: totalPages,
            pages_processed: pagesToProcessInInitial,
          }
        : null;

    const { productsCreated, productsUpdated, pendingThumbnailOverwrites } =
      await upsertExtractedProducts(
        supabase,
        allProducts,
        {
          photoType: "flyer_pdf",
          claudeJson,
          uploadId,
          photoUrl,
          thumbnailUrl: null,
          backThumbnailUrl: null,
          flyerIdForProducts: flyerId,
          flyerCountry,
        },
        now,
      );

    if (flyerRemainingPages) {
      const extractedData = {
        flyer_id: flyerRemainingPages.flyer_id,
        total_pages: flyerRemainingPages.total_pages,
        pages_processed: flyerRemainingPages.pages_processed,
        flyer_title:
          (claudeJson as { flyer_title?: string }).flyer_title ?? null,
        special_valid_from: claudeJson.special_valid_from ?? null,
        special_valid_to: claudeJson.special_valid_to ?? null,
        flyer_country: flyerCountry,
        country_uncertain: flyerCountryUncertain,
      };
      const { error: finalErr } = await supabase
        .from("photo_uploads")
        .update({
          status: "processing",
          photo_type: "flyer_pdf",
          extracted_data:
            extractedData as unknown as Record<string, unknown>,
          products_created: productsCreated,
          products_updated: productsUpdated,
          processed_at: now,
          error_message: null,
          pending_thumbnail_overwrites:
            pendingThumbnailOverwrites.length > 0
              ? pendingThumbnailOverwrites
              : null,
        })
        .eq("upload_id", uploadId);
      if (finalErr) {
        log.error("[process-photo] Finalize (remaining pages) failed:", finalErr.message);
        return NextResponse.json(
          { error: "Failed to finalize" },
          { status: 500 },
        );
      }
      return NextResponse.json({
        ok: true,
        upload_id: uploadId,
        photo_type: "flyer_pdf",
        flyer_id: flyerRemainingPages.flyer_id,
        total_pages: flyerRemainingPages.total_pages,
        pages_processed: flyerRemainingPages.pages_processed,
        process_remaining_pages: true,
        products_created: productsCreated,
        products_updated: productsUpdated,
        ...(flyerCountryUncertain
          ? { country_uncertain: true, flyer_country: flyerCountry }
          : { flyer_country: flyerCountry }),
      });
    }

    const finalExtractedData: Record<string, unknown> = {
      ...(claudeJson as unknown as Record<string, unknown>),
      flyer_country: flyerCountry,
      country_uncertain: flyerCountryUncertain,
    };
    const { error: finalErr } = await supabase
      .from("photo_uploads")
      .update({
        status: "completed",
        photo_type: "flyer_pdf",
        extracted_data: finalExtractedData,
        products_created: productsCreated,
        products_updated: productsUpdated,
        processed_at: now,
        error_message: null,
        pending_thumbnail_overwrites:
          pendingThumbnailOverwrites.length > 0
            ? pendingThumbnailOverwrites
            : null,
      })
      .eq("upload_id", uploadId);
    if (finalErr) {
      log.error("[process-photo] Finalize failed:", finalErr.message);
      return NextResponse.json(
        { error: "Failed to finalize" },
        { status: 500 },
      );
    }

    log.debug(
      "[process-photo] Completed",
      uploadId,
      "products_created:",
      productsCreated,
      "products_updated:",
      productsUpdated,
    );
    return NextResponse.json({
      ok: true,
      upload_id: uploadId,
      photo_type: "flyer_pdf",
      products_created: productsCreated,
      products_updated: productsUpdated,
      pending_thumbnail_overwrites: pendingThumbnailOverwrites.length,
      flyer_country: flyerCountry,
      ...(flyerCountryUncertain ? { country_uncertain: true } : {}),
    });
  } catch (e) {
    const msg =
      e instanceof Error ? e.message : "Flyer PDF processing failed";
    log.error("[process-photo] Flyer PDF error:", msg);
    await supabase
      .from("photo_uploads")
      .update({ status: "error", error_message: msg, processed_at: now })
      .eq("upload_id", uploadId);
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
