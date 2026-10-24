/**
 * Global daily budget for Claude calls, shared by every route and every user.
 *
 * `consumeGlobalAiCall()` is called by `callClaude()` once per logical Claude
 * call (retries of the same call are not counted again), so the cap counts
 * REAL calls regardless of which route issued them or how many a route makes.
 * Route guards only *peek* ({@link peekGlobalAiCap}) to fail fast with a 429
 * before doing expensive work.
 *
 * Fails closed: in production without Upstash, or when Redis errors, calls are
 * refused with {@link AiBudgetError} (status 503).
 */

import {
  getGlobalAiCapLimiter,
  isRateLimitConfigured,
} from "@/lib/api/rate-limit";
import { log } from "@/lib/utils/logger";

/** Identifier of the single shared counter used for the global daily cap. */
export const GLOBAL_CAP_IDENTIFIER = "global";

export type AiBudgetErrorCode = "global_daily_cap" | "ai_unavailable";

/** Thrown when a Claude call is refused by the global budget. */
export class AiBudgetError extends Error {
  constructor(
    public readonly code: AiBudgetErrorCode,
    public readonly status: 429 | 503,
    /** Epoch ms when the cap window resets (only for global_daily_cap). */
    public readonly reset?: number,
  ) {
    super(
      code === "global_daily_cap"
        ? "Global daily AI cap reached"
        : "AI budget service unavailable",
    );
    this.name = "AiBudgetError";
  }
}

/** True when AI must be refused because limits cannot be enforced (production only). */
export function isBudgetUnavailable(): boolean {
  return process.env.NODE_ENV === "production" && !isRateLimitConfigured();
}

/**
 * Count one Claude call against the global daily cap.
 * Throws {@link AiBudgetError} when the cap is reached or the budget service
 * is unavailable. No-op outside production when Upstash is not configured.
 */
export async function consumeGlobalAiCall(): Promise<void> {
  if (isBudgetUnavailable()) {
    log.error("[ai-budget] Upstash not configured in production – refusing Claude call");
    throw new AiBudgetError("ai_unavailable", 503);
  }
  const limiter = getGlobalAiCapLimiter();
  if (!limiter) return;

  let result: { success: boolean; reset: number };
  try {
    result = await limiter.limit(GLOBAL_CAP_IDENTIFIER);
  } catch (err) {
    log.error("[ai-budget] Global cap check failed – failing closed:", err);
    throw new AiBudgetError("ai_unavailable", 503);
  }
  if (!result.success) {
    log.warn("[ai-budget] Global daily AI cap reached");
    throw new AiBudgetError("global_daily_cap", 429, result.reset);
  }
}

/**
 * Non-consuming check used by route guards. Resolves to the reset time (epoch
 * ms) when the cap is exhausted, otherwise null. Throws {@link AiBudgetError}
 * (503) if the budget service fails.
 */
export async function peekGlobalAiCap(): Promise<{ reset: number } | null> {
  const limiter = getGlobalAiCapLimiter();
  if (!limiter) return null;
  try {
    const { remaining, reset } = await limiter.getRemaining(GLOBAL_CAP_IDENTIFIER);
    return remaining <= 0 ? { reset } : null;
  } catch (err) {
    log.error("[ai-budget] Global cap peek failed – failing closed:", err);
    throw new AiBudgetError("ai_unavailable", 503);
  }
}
