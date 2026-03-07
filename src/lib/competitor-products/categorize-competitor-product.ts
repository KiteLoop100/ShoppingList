/**
 * Central categorization service for competitor products.
 *
 * 3-stage fallback chain:
 *   1. AI hint from caller (e.g. receipt OCR already inferred demand_group)
 *   2. Keyword-based fallback (getDemandGroupFallback — free, instant)
 *   3. AI classification via /api/assign-category (Haiku — cheap, ~90% accuracy)
 *
 * If all stages fail, demand_group_code stays NULL. The product still works;
 * it just won't appear in the catalog view.
 */

import { getDemandGroupFallback } from "@/lib/products/demand-group-fallback";
import { updateCompetitorProduct } from "./competitor-product-service";
import { log } from "@/lib/utils/logger";

/**
 * Extract the numeric demand group code from either format:
 *   "83-Milch/Sahne/Butter" → "83"
 *   "83"                    → "83"
 * Returns null if the input is empty or unparseable.
 */
export function extractDemandGroupCode(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(\d+)/);
  return match ? match[1] : null;
}

export interface CategorizeOptions {
  /** Pre-computed demand group from an AI caller (e.g. receipt OCR). */
  demandGroupFromAI?: string | null;
  /** Whether to skip the /api/assign-category AI call (e.g. in server context). */
  skipAICall?: boolean;
}

/**
 * Assign a demand_group_code to a competitor product using the fallback chain.
 * Writes the result to the DB and returns the resolved code (or null).
 */
export async function categorizeCompetitorProduct(
  productId: string,
  productName: string,
  options: CategorizeOptions = {},
): Promise<string | null> {
  const { demandGroupFromAI, skipAICall = false } = options;

  let resolvedCode: string | null = null;

  // Stage 1: Use AI hint from caller (receipt OCR / photo extraction)
  if (demandGroupFromAI) {
    resolvedCode = extractDemandGroupCode(demandGroupFromAI);
    if (resolvedCode) {
      log.info(`[categorize] Stage 1 (AI hint): "${productName}" → ${resolvedCode}`);
    }
  }

  // Stage 2: Keyword-based fallback
  if (!resolvedCode) {
    const fallback = getDemandGroupFallback(productName);
    if (fallback) {
      resolvedCode = extractDemandGroupCode(fallback.demand_group);
      if (resolvedCode) {
        log.info(`[categorize] Stage 2 (keyword): "${productName}" → ${resolvedCode}`);
      }
    }
  }

  // Stage 3: AI classification via /api/assign-category
  if (!resolvedCode && !skipAICall) {
    try {
      const res = await fetch("/api/assign-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName }),
      });
      if (res.ok) {
        const data = await res.json() as { demand_group_code?: string };
        if (data.demand_group_code) {
          resolvedCode = data.demand_group_code;
          log.info(`[categorize] Stage 3 (AI): "${productName}" → ${resolvedCode}`);
        }
      }
    } catch (err) {
      log.warn("[categorize] AI classification failed (non-blocking):", err);
    }
  }

  // Persist if we resolved a code
  if (resolvedCode) {
    try {
      await updateCompetitorProduct(productId, { demand_group_code: resolvedCode });
    } catch (err) {
      log.warn("[categorize] Failed to save demand_group_code:", err);
    }
  }

  return resolvedCode;
}

export interface CategorizeServerOptions {
  /** Pre-computed demand group from AI (e.g. receipt OCR). */
  demandGroupFromAI?: string | null;
}

/**
 * Server-side variant: uses Supabase admin client directly instead of
 * fetch("/api/assign-category"). Suitable for API route handlers.
 */
export async function categorizeCompetitorProductServer(
  supabase: import("@supabase/supabase-js").SupabaseClient,
  productId: string,
  productName: string,
  options: CategorizeServerOptions = {},
): Promise<string | null> {
  const { demandGroupFromAI } = options;

  let resolvedCode: string | null = null;

  // Stage 1: Use AI hint from caller
  if (demandGroupFromAI) {
    resolvedCode = extractDemandGroupCode(demandGroupFromAI);
    if (resolvedCode) {
      log.info(`[categorize-server] Stage 1 (AI hint): "${productName}" → ${resolvedCode}`);
    }
  }

  // Stage 2: Keyword-based fallback
  if (!resolvedCode) {
    const fallback = getDemandGroupFallback(productName);
    if (fallback) {
      resolvedCode = extractDemandGroupCode(fallback.demand_group);
      if (resolvedCode) {
        log.info(`[categorize-server] Stage 2 (keyword): "${productName}" → ${resolvedCode}`);
      }
    }
  }

  // Stage 3: Inline AI classification (server-side, no HTTP round-trip)
  if (!resolvedCode) {
    try {
      const { loadDemandGroups, buildDemandGroupListPrompt } = await import("@/lib/categories/constants");
      const { callClaude } = await import("@/lib/api/claude-client");
      const { CLAUDE_MODEL_HAIKU } = await import("@/lib/api/config");

      const groups = await loadDemandGroups(supabase);
      const groupList = buildDemandGroupListPrompt(groups);

      const prompt = `Du bist ein Supermarkt-Kategorie-Zuordner. Ordne das folgende Produkt genau EINER Warengruppe (Demand Group) zu.

Produkt: "${productName}"

Verfügbare Warengruppen (Code: Name):
${groupList}

Antworte NUR mit dem Code (z.B. "83"), nichts anderes. Keine Erklärung, kein Text drumherum.`;

      const text = (await callClaude({
        model: CLAUDE_MODEL_HAIKU,
        messages: [{ role: "user", content: prompt }],
        max_tokens: 100,
      })).trim();

      const matched = groups.find((g) => text.includes(g.code));
      if (matched) {
        resolvedCode = matched.code;
        log.info(`[categorize-server] Stage 3 (AI): "${productName}" → ${resolvedCode}`);
      }
    } catch (err) {
      log.warn("[categorize-server] AI classification failed (non-blocking):", err);
    }
  }

  // Persist if we resolved a code
  if (resolvedCode) {
    const { error } = await supabase
      .from("competitor_products")
      .update({
        demand_group_code: resolvedCode,
        updated_at: new Date().toISOString(),
      })
      .eq("product_id", productId);

    if (error) {
      log.warn("[categorize-server] Failed to save demand_group_code:", error.message);
    }
  }

  return resolvedCode;
}
