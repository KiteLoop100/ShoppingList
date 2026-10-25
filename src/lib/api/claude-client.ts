/**
 * Shared Claude API client — eliminates duplicated fetch/parse/clean logic
 * across 7+ API route handlers (BL-33).
 *
 * Includes timeout (30s) and retry with exponential backoff for transient
 * errors (429, 500, 502, 503, 529).
 */

import { CLAUDE_MODEL_MAIN } from "./config";
import { consumeGlobalAiCall } from "./ai-budget";
import { tryRepairTruncatedJson } from "@/lib/utils/repair-json";
import { log } from "@/lib/utils/logger";

export type ClaudeContentBlock =
  | { type: "text"; text: string }
  | { type: "image"; source: { type: "base64"; media_type: string; data: string } }
  | { type: "image"; source: { type: "url"; url: string } }
  | { type: "document"; source: { type: "base64"; media_type: string; data: string } };

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
}

export interface ClaudeOptions {
  model?: string;
  system?: string;
  messages: ClaudeMessage[];
  max_tokens: number;
  // NOTE: there is deliberately no `temperature` (or top_p / top_k). The Claude 5.x
  // models answer HTTP 400 "`temperature` is deprecated for this model." and every
  // route using them failed. Steer style and determinism through the prompt instead.
  /** Per-attempt timeout in ms (default 30 s). */
  timeoutMs?: number;
  /**
   * Absolute deadline (epoch ms) for the WHOLE call including retries and
   * backoff. Attempt timeouts are clamped to the time left and no retry is
   * started that cannot fit. See `routeDeadline()` in config.ts.
   */
  deadlineAt?: number;
}

export class ClaudeApiError extends Error {
  constructor(
    public readonly status: number,
    body: string,
  ) {
    super(`Claude API ${status}: ${body}`);
    this.name = "ClaudeApiError";
  }
}

const CLAUDE_TIMEOUT_MS = 30_000;
const MAX_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([429, 500, 502, 503, 529]);
const API_URL = "https://api.anthropic.com/v1/messages";
/** An attempt is only started when at least this much of the deadline is left. */
const MIN_ATTEMPT_MS = 5_000;

function remainingMs(deadlineAt: number | undefined): number {
  return deadlineAt === undefined ? Number.POSITIVE_INFINITY : deadlineAt - Date.now();
}

function isTimeoutError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "TimeoutError";
}

interface ClaudeApiResponse {
  content?: Array<{ type?: string; text?: string }>;
  stop_reason?: string;
}

/**
 * Text of the FIRST `type: "text"` block in a Messages API response.
 * Newer models may return other block types first (e.g. thinking or tool
 * use), so `content[0].text` is not safe. Returns "" when no text block exists.
 */
export function extractResponseText(data: ClaudeApiResponse): string {
  const block = data.content?.find((b) => b.type === "text");
  return typeof block?.text === "string" ? block.text : "";
}

/**
 * Call the Anthropic Messages API and return the raw text response.
 * Retries up to {@link MAX_RETRIES} times on transient errors and timeouts,
 * never past `options.deadlineAt` when set.
 * Every call is counted once against the global daily cap (see ai-budget.ts);
 * throws `AiBudgetError` when the cap is reached or cannot be verified.
 * Throws {@link ClaudeApiError} on non-retryable non-2xx responses.
 */
export async function callClaude(options: ClaudeOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  await consumeGlobalAiCall();

  const reqBody: Record<string, unknown> = {
    model: options.model ?? CLAUDE_MODEL_MAIN,
    max_tokens: options.max_tokens,
    messages: options.messages,
  };
  if (options.system) reqBody.system = options.system;

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  const bodyJson = JSON.stringify(reqBody);

  const effectiveTimeout = options.timeoutMs ?? CLAUDE_TIMEOUT_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const remaining = remainingMs(options.deadlineAt);
    if (remaining < MIN_ATTEMPT_MS) {
      throw new ClaudeApiError(408, `Claude deadline exceeded before attempt ${attempt + 1}`);
    }
    const attemptTimeout = Math.min(effectiveTimeout, remaining);

    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers,
        body: bodyJson,
        signal: AbortSignal.timeout(attemptTimeout),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "unknown");
        const delay = 1000 * Math.pow(2, attempt);
        const retryFits = remainingMs(options.deadlineAt) > delay + MIN_ATTEMPT_MS;
        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES && retryFits) {
          log.warn(`[claude] ${res.status} on attempt ${attempt + 1}, retrying in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new ClaudeApiError(res.status, errText.slice(0, 300));
      }

      const data = (await res.json()) as ClaudeApiResponse;
      const text = extractResponseText(data);
      if (!text) {
        log.warn("[claude] empty response text from API", { stop_reason: data.stop_reason });
      }
      // A cut-off JSON answer can be "repaired" into a plausible but wrong value,
      // so make the truncation visible instead of failing silently.
      if (data.stop_reason === "max_tokens") {
        log.warn("[claude] answer truncated at max_tokens; raise the limit for this call", {
          model: reqBody.model,
          max_tokens: options.max_tokens,
        });
      }
      return text;
    } catch (err) {
      if (isTimeoutError(err) && attempt < MAX_RETRIES) {
        log.warn(`[claude] timeout on attempt ${attempt + 1}, retrying`);
        continue;
      }
      if (err instanceof ClaudeApiError) throw err;
      if (isTimeoutError(err)) {
        throw new ClaudeApiError(408, "Claude API timeout after all retries");
      }
      throw err;
    }
  }

  throw new ClaudeApiError(500, "Exhausted all retries without a response");
}

/** Strip ```json ... ``` fences that Claude sometimes wraps around JSON output. */
export function cleanJsonFences(text: string): string {
  return text
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/**
 * Removes leading ```json / ``` and trailing ``` so bracket scanning can find the payload.
 */
function stripMarkdownJsonFences(text: string): string {
  return text
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/**
 * Returns the first balanced JSON object or array substring, respecting string literals
 * (so `{` / `}` / `[` / `]` inside strings do not affect depth).
 */
export function extractFirstBalancedJsonValue(text: string): string | null {
  const start = text.search(/[\[{]/);
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escape) {
        escape = false;
      } else if (c === "\\") {
        escape = true;
      } else if (c === '"') {
        inString = false;
      }
      continue;
    }
    if (c === '"') {
      inString = true;
      continue;
    }
    if (c === "{" || c === "[") {
      depth++;
    } else if (c === "}" || c === "]") {
      depth--;
      if (depth === 0) {
        return text.slice(start, i + 1);
      }
    }
  }

  return null;
}

function getJsonTextForParse(raw: string): string {
  const trimmed = raw.trim();
  // Remove ```json / ``` fences anywhere (Claude often wraps JSON in markdown).
  let withoutFences = trimmed
    .replace(/```(?:json)?\s*/gi, "")
    .replace(/\s*```/g, "")
    .trim();
  const fromBalanced =
    extractFirstBalancedJsonValue(withoutFences) ??
    extractFirstBalancedJsonValue(trimmed) ??
    extractFirstBalancedJsonValue(stripMarkdownJsonFences(trimmed));
  if (fromBalanced) return fromBalanced.trim();

  return cleanJsonFences(trimmed).trim();
}

/**
 * Strip JSON fences / trailing prose, parse as T, and attempt truncated-JSON repair on failure.
 * Use when you already have raw Claude text (e.g. from a retry wrapper).
 */
export function parseClaudeJsonResponse<T>(raw: string): T {
  const cleaned = getJsonTextForParse(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const repaired = tryRepairTruncatedJson(cleaned);
    if (repaired) {
      try {
        return JSON.parse(repaired) as T;
      } catch {
        /* fall through to final error */
      }
    }
    throw new Error(
      `Failed to parse Claude JSON response.\nRaw (first 500 chars): ${cleaned.slice(0, 500)}`,
    );
  }
}

/**
 * Call the Anthropic Messages API, strip JSON fences, and parse the response as `T`.
 * Automatically attempts truncated-JSON repair on parse failure.
 * Throws on non-2xx responses ({@link ClaudeApiError}) or unrecoverable parse failures.
 */
export async function callClaudeJSON<T>(options: ClaudeOptions): Promise<T> {
  const raw = await callClaude(options);
  return parseClaudeJsonResponse<T>(raw);
}
