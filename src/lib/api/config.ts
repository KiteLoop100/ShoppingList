/**
 * Shared API constants used across multiple route handlers.
 */

export const CLAUDE_MODEL_SONNET = "claude-sonnet-4-5-20250929";
export const CLAUDE_MODEL_HAIKU = "claude-haiku-4-5-20251001";
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
