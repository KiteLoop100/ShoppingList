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

export interface CategorizeResult {
  demand_group_code: string;
  demand_sub_group?: string | null;
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
  let resolvedSubGroup: string | null = null;

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

  // Stage 3: AI classification via /api/assign-category (now returns sub-group too)
  if (!resolvedCode && !skipAICall) {
    try {
      const res = await fetch("/api/assign-category", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productName }),
      });
      if (res.ok) {
        const data = await res.json() as {
          demand_group_code?: string;
          demand_sub_group?: string | null;
          action?: "matched" | "created";
        };
        if (data.demand_group_code) {
          resolvedCode = data.demand_group_code;
          resolvedSubGroup = data.demand_sub_group ?? null;
          log.info(
            `[categorize] Stage 3 (AI/${data.action ?? "unknown"}): "${productName}" → ${resolvedCode}` +
            (resolvedSubGroup ? ` / ${resolvedSubGroup}` : "")
          );
        }
      }
    } catch (err) {
      log.warn("[categorize] AI classification failed (non-blocking):", err);
    }
  }

  // Persist if we resolved a code
  if (resolvedCode) {
    try {
      const update: Record<string, unknown> = { demand_group_code: resolvedCode };
      if (resolvedSubGroup) update.demand_sub_group = resolvedSubGroup;
      await updateCompetitorProduct(productId, update);
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
  let resolvedSubGroup: string | null = null;

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

  // Stage 3: Inline AI classification with sub-groups
  if (!resolvedCode) {
    try {
      const {
        loadDemandGroups,
        loadDemandSubGroups,
        buildDemandGroupsAndSubGroupsPrompt,
      } = await import("@/lib/categories/constants");
      const { callClaudeJSON } = await import("@/lib/api/claude-client");
      const { CLAUDE_MODEL_HAIKU } = await import("@/lib/api/config");

      const groups = await loadDemandGroups(supabase);
      const subGroups = await loadDemandSubGroups(supabase);
      const groupsPrompt = buildDemandGroupsAndSubGroupsPrompt(groups, subGroups);

      const result = await callClaudeJSON<{
        demand_group_code: string | null;
        demand_sub_group?: string;
        confidence: string;
      }>({
        model: CLAUDE_MODEL_HAIKU,
        system: `Du bist ein Supermarkt-Kategorie-Zuordner.
Ordne das Produkt einer bestehenden Demand Group und Sub-Group zu.
Antworte als JSON: {"demand_group_code": "83", "demand_sub_group": "83-02", "confidence": "high"|"medium"|"low"}
Wenn KEINE passende Gruppe existiert, antworte: {"demand_group_code": null, "confidence": "none"}`,
        messages: [{
          role: "user",
          content: `Produkt: "${productName}"\n\n${groupsPrompt}`,
        }],
        max_tokens: 200,
      });

      if (result.demand_group_code && result.confidence !== "none") {
        const matched = groups.find((g) => g.code === result.demand_group_code);
        if (matched) {
          resolvedCode = matched.code;
          if (result.demand_sub_group) {
            const sub = subGroups.find((s) => s.code === result.demand_sub_group);
            if (sub) resolvedSubGroup = sub.code;
          }
          log.info(
            `[categorize-server] Stage 3 (AI): "${productName}" → ${resolvedCode}` +
            (resolvedSubGroup ? ` / ${resolvedSubGroup}` : "")
          );
        }
      }
    } catch (err) {
      log.warn("[categorize-server] AI classification failed (non-blocking):", err);
    }
  }

  // Persist if we resolved a code
  if (resolvedCode) {
    const updateData: Record<string, unknown> = {
      demand_group_code: resolvedCode,
      updated_at: new Date().toISOString(),
    };
    if (resolvedSubGroup) updateData.demand_sub_group = resolvedSubGroup;

    const { error } = await supabase
      .from("competitor_products")
      .update(updateData)
      .eq("product_id", productId);

    if (error) {
      log.warn("[categorize-server] Failed to save demand_group_code:", error.message);
    }
  }

  return resolvedCode;
}
