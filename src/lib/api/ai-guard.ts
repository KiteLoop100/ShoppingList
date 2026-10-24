/**
 * Shared protection for routes that spend AI budget (Claude / Gemini).
 *
 * The app is anonymous-first, so every visitor holds an authenticated
 * (anonymous) session and `requireAuth()` alone is not a spending guard.
 * These helpers add the layers that actually bound cost:
 *   1. fail closed (503) in production when Upstash is not configured,
 *   2. per-user AND per-IP rate limits (both must pass),
 *   3. a global daily cap across all users (env `AI_GLOBAL_DAILY_CAP`).
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
  checkRateLimit,
  getGlobalAiCapLimiter,
  getIdentifier,
  isRateLimitConfigured,
} from "@/lib/api/rate-limit";
import { log } from "@/lib/utils/logger";

/** Identifier of the single shared counter used for the global daily cap. */
export const GLOBAL_CAP_IDENTIFIER = "global";

function serviceUnavailable(): NextResponse {
  return NextResponse.json(
    { error: "Service temporarily unavailable" },
    { status: 503 },
  );
}

/**
 * In production, AI routes must never run without working rate limiting.
 * Returns a 503 response in that case, otherwise null.
 */
export function rateLimiterUnavailableResponse(): NextResponse | null {
  if (process.env.NODE_ENV === "production" && !isRateLimitConfigured()) {
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
 * Apply, in order: per-user limit, per-IP limit, global daily cap.
 * Every layer must pass. Returns a 429 (or 503 if the limiter itself fails)
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

    const globalCap = getGlobalAiCapLimiter();
    if (globalCap) {
      const { success, reset } = await globalCap.limit(GLOBAL_CAP_IDENTIFIER);
      if (!success) {
        log.warn("[ai-guard] Global daily AI cap reached");
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
    }
    return null;
  } catch (err) {
    log.error("[ai-guard] Rate limiter failed – failing closed:", err);
    return serviceUnavailable();
  }
}
