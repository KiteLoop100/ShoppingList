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
