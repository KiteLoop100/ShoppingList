/**
 * Shared protection for routes that spend AI budget (Claude / Gemini).
 *
 * The app is anonymous-first, so every visitor holds an authenticated
 * (anonymous) session and `requireAuth()` alone is not a spending guard.
 * These helpers add the layers that actually bound cost:
 *   1. fail closed (503) in production when Upstash is not configured,
 *   2. per-user AND per-IP rate limits (both must pass),
 *   3. a fast-fail check of the global daily cap (env `AI_GLOBAL_DAILY_CAP`).
 *
 * The global cap itself is COUNTED per real Claude call inside
 * `callClaude()` (see ai-budget.ts), so it covers every route and every retry
 * of the model prompt; the check here only avoids starting expensive work when
 * the cap is already exhausted. Use {@link aiBudgetErrorResponse} in route
 * catch blocks to turn a mid-request `AiBudgetError` into a 429/503.
 *
 * Usage in a route handler:
 *   const access = await requireAiUser(request);        // 503 / 401
 *   if (access instanceof NextResponse) return access;
 *   ...validate input...
 *   const limited = await enforceAiLimits(request, access.user.id, claudeRateLimit);
 *   if (limited) return limited;                         // 429 / 503
 */

import { NextResponse } from "next/server";
import type { Ratelimit } from "@upstash/ratelimit";
import type { User } from "@supabase/supabase-js";
import { requireAuth } from "@/lib/api/guards";
import {
  AiBudgetError,
  isBudgetUnavailable,
  peekGlobalAiCap,
} from "@/lib/api/ai-budget";
import { checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { log } from "@/lib/utils/logger";

function serviceUnavailable(): NextResponse {
  return NextResponse.json(
    { error: "Service temporarily unavailable" },
    { status: 503 },
  );
}

function globalCapResponse(reset: number): NextResponse {
  const retryAfterS = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
  return NextResponse.json(
    {
      error: "Daily AI capacity reached. Please try again tomorrow.",
      code: "global_daily_cap",
      reset,
    },
    { status: 429, headers: { "Retry-After": String(retryAfterS) } },
  );
}

/**
 * Maps an {@link AiBudgetError} (thrown by `callClaude`) to a 429/503 response.
 * Returns null for any other error so callers can keep their own handling.
 */
export function aiBudgetErrorResponse(err: unknown): NextResponse | null {
  if (!(err instanceof AiBudgetError)) return null;
  return err.code === "global_daily_cap"
    ? globalCapResponse(err.reset ?? Date.now() + 60_000)
    : serviceUnavailable();
}

/**
 * In production, AI routes must never run without working rate limiting.
 * Returns a 503 response in that case, otherwise null.
 */
export function rateLimiterUnavailableResponse(): NextResponse | null {
  if (isBudgetUnavailable()) {
    log.error("[ai-guard] Upstash not configured in production – refusing AI request");
    return serviceUnavailable();
  }
  return null;
}

/**
 * Fail closed when rate limiting is unavailable (production), then require a
 * valid Supabase session (anonymous or registered).
 */
export async function requireAiUser(
  request: Request,
): Promise<{ user: User } | NextResponse> {
  const unavailable = rateLimiterUnavailableResponse();
  if (unavailable) return unavailable;
  return requireAuth(request);
}

/**
 * Apply, in order: per-user limit, per-IP limit, global-cap fast-fail.
 * Every layer must pass. Returns a 429 (or 503 if a limiter itself fails)
 * to `return` from the route, or null when the request may proceed.
 *
 * With no Upstash configured (non-production only) all layers are skipped.
 */
export async function enforceAiLimits(
  request: Request,
  userId: string,
  limiter: Ratelimit | null,
): Promise<NextResponse | null> {
  try {
    const perUser = await checkRateLimit(limiter, `user:${userId}`);
    if (perUser) return perUser;

    const perIp = await checkRateLimit(limiter, `ip:${getIdentifier(request)}`);
    if (perIp) return perIp;

    const exhausted = await peekGlobalAiCap();
    if (exhausted) return globalCapResponse(exhausted.reset);
    return null;
  } catch (err) {
    const mapped = aiBudgetErrorResponse(err);
    if (mapped) return mapped;
    log.error("[ai-guard] Rate limiter failed – failing closed:", err);
    return serviceUnavailable();
  }
}
