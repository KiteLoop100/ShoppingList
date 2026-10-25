/**
 * Shared API constants used across route handlers AND `scripts/`.
 *
 * Claude model IDs live ONLY here. Routes and scripts import these constants;
 * nothing else may hardcode a `claude-*` ID. Each tier can be overridden via
 * env (e.g. to pin a dated snapshot or trial a new generation) — an empty or
 * whitespace-only value falls back to the default.
 */

function envOr(name: string, fallback: string): string {
  const value = process.env[name]?.trim();
  return value ? value : fallback;
}

/** Main tier (Sonnet): vision extraction, receipts, flyers, recipes, insights. */
export const CLAUDE_MODEL_MAIN = envOr("CLAUDE_MODEL_MAIN", "claude-sonnet-5-5");
/** Fast tier (Haiku): categorization and quality checks. */
export const CLAUDE_MODEL_FAST = envOr("CLAUDE_MODEL_FAST", "claude-haiku-5-5");
/** Highest-quality tier (Opus): batch scripts only (flyer import), never routes. */
export const CLAUDE_MODEL_OPUS = envOr("CLAUDE_MODEL_OPUS", "claude-opus-5-5");

export const ADMIN_COOKIE_NAME = "admin_session";

/**
 * Per-call timeout for flyer PDF extraction. A single flyer page can need
 * up to 16k output tokens, which regularly exceeds the 30 s default.
 */
export const FLYER_CLAUDE_TIMEOUT_MS = 150_000;

/** Time reserved after the last Claude call for DB writes and the response. */
export const ROUTE_DEADLINE_SAFETY_MS = 30_000;

/**
 * Absolute deadline (epoch ms) for Claude work inside a route, derived from the
 * route's `maxDuration` (seconds) minus {@link ROUTE_DEADLINE_SAFETY_MS}.
 * Pass it as `deadlineAt` to `callClaude` so timeouts + retries + backoff can
 * never run past the platform limit.
 */
export function routeDeadline(maxDurationS: number, startedAt: number = Date.now()): number {
  return startedAt + maxDurationS * 1000 - ROUTE_DEADLINE_SAFETY_MS;
}
