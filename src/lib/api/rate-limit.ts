import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { NextResponse } from "next/server";
import { DAILY_AI_RECIPE_LIMIT } from "@/lib/recipe/constants";
import { log } from "@/lib/utils/logger";

const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;

if (!redis) {
  log.warn("[rate-limit] Upstash not configured – rate limiting disabled");
}

/** 50 requests per hour per user – for endpoints that call Claude. TESTING PHASE: reduce to 5-10/h before public release. */
export const claudeRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "1 h"),
      analytics: true,
      prefix: "ratelimit:claude",
    })
  : null;

/** 5 attempts per 15 minutes per IP – brute-force protection for admin login. */
export const loginRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(5, "15 m"),
      analytics: true,
      prefix: "ratelimit:login",
    })
  : null;

/** 20 requests per minute per user – for non-Claude endpoints (uploads, flyer page continuations). */
export const generalRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(20, "1 m"),
      analytics: true,
      prefix: "ratelimit:general",
    })
  : null;

/** 10 feedbacks per day per user – anti-spam for the feedback system (F25). */
export const feedbackRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(10, "1 d"),
      analytics: true,
      prefix: "ratelimit:feedback",
    })
  : null;

/** 50 recipe URL extractions per day per user (F-RECIPE-IMPORT). */
export const recipeExtractRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(50, "1 d"),
      analytics: true,
      prefix: "ratelimit:recipe-extract",
    })
  : null;

/**
 * Shared daily AI budget for F-RECIPE-COOK cook-chat and future recipe-suggestion
 * endpoints (decision D8). Recipe URL extract uses {@link recipeExtractRateLimit} separately.
 */
export const recipeAiDailyRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(DAILY_AI_RECIPE_LIMIT, "1 d"),
      analytics: true,
      prefix: "ratelimit:recipe-ai-daily",
    })
  : null;

export function getIdentifier(
  request: Request,
  userId?: string | null
): string {
  if (userId) return userId;
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "anonymous"
  );
}

/**
 * Check rate limit and return a 429 NextResponse if exceeded, or null if allowed.
 * Returns null (= allowed) when Upstash is not configured (local dev).
 */
export async function checkRateLimit(
  limiter: Ratelimit | null,
  identifier: string
): Promise<NextResponse | null> {
  if (!limiter) return null;

  const { success, limit, remaining, reset } =
    await limiter.limit(identifier);

  if (!success) {
    return NextResponse.json(
      {
        error: "Rate limit exceeded. Try again later.",
        limit,
        remaining,
        reset,
      },
      { status: 429 }
    );
  }

  return null;
}
