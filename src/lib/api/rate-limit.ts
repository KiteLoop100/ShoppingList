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

/**
 * 60 flyer pages per hour per user / per IP. Each page is a 16k-token Sonnet
 * PDF call, so this is the hourly budget; {@link generalRateLimit} (20/min)
 * stays in place as burst control.
 */
export const flyerRateLimit = redis
  ? new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(60, "1 h"),
      analytics: true,
      prefix: "ratelimit:flyer",
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

/** True when Upstash credentials are present (rate limiting is actually enforced). */
export function isRateLimitConfigured(): boolean {
  return redis !== null;
}

/** Default number of AI-route calls allowed per UTC day across ALL users. */
export const DEFAULT_GLOBAL_AI_DAILY_CAP = 200;

/**
 * Global daily cap on AI calls, from env `AI_GLOBAL_DAILY_CAP`.
 * Falls back to {@link DEFAULT_GLOBAL_AI_DAILY_CAP} when unset or not a positive integer.
 */
export function getGlobalAiDailyCap(): number {
  const raw = process.env.AI_GLOBAL_DAILY_CAP;
  if (!raw) return DEFAULT_GLOBAL_AI_DAILY_CAP;
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : DEFAULT_GLOBAL_AI_DAILY_CAP;
}

const globalCapLimiters = new Map<number, Ratelimit>();

/**
 * Fixed-window (UTC day) counter shared by every user, keyed by one constant
 * identifier. Returns null when Upstash is not configured.
 */
export function getGlobalAiCapLimiter(): Ratelimit | null {
  if (!redis) return null;
  const cap = getGlobalAiDailyCap();
  let limiter = globalCapLimiters.get(cap);
  if (!limiter) {
    limiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(cap, "1 d"),
      analytics: true,
      prefix: "ratelimit:ai-global",
    });
    globalCapLimiters.set(cap, limiter);
  }
  return limiter;
}

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
