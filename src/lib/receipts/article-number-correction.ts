/**
 * Transposition-based auto-correction for OCR-misread article numbers.
 * Generates adjacent-digit-swap variants and checks them against the
 * product database to find the intended product.
 */

import { findProductByArticleNumber, type FindExistingResult } from "@/lib/products/find-existing";
import { log } from "@/lib/utils/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

const MIN_DIGITS_FOR_CORRECTION = 5;

/**
 * Generate all single adjacent-digit transposition variants of a numeric string.
 * For "123456" this yields ["213456", "132456", "124356", "123546", "123465"].
 */
export function generateTranspositionVariants(num: string): string[] {
  const variants: string[] = [];
  for (let i = 0; i < num.length - 1; i++) {
    const chars = num.split("");
    [chars[i], chars[i + 1]] = [chars[i + 1], chars[i]];
    const variant = chars.join("");
    if (variant !== num) variants.push(variant);
  }
  return variants;
}

export interface CorrectionResult {
  correctedNumber: string;
  product: FindExistingResult;
}

/**
 * Try to auto-correct an article number that didn't match any product.
 * Tests all single adjacent-digit transpositions against the DB and
 * returns the first match, or null if none found.
 */
export async function tryAutoCorrectArticleNumber(
  supabase: SupabaseClient,
  originalNormalized: string,
  select = "product_id",
): Promise<CorrectionResult | null> {
  if (originalNormalized.length < MIN_DIGITS_FOR_CORRECTION) return null;

  const variants = generateTranspositionVariants(originalNormalized);
  for (const variant of variants) {
    const found = await findProductByArticleNumber(supabase, variant, select);
    if (found) {
      log.info(
        `[receipt-ocr] Auto-corrected article number: ${originalNormalized} -> ${variant}`,
      );
      return { correctedNumber: variant, product: found };
    }
  }
  return null;
}
