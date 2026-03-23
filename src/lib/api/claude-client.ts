/**
 * Shared Claude API client — eliminates duplicated fetch/parse/clean logic
 * across 7+ API route handlers (BL-33).
 *
 * Includes timeout (30s) and retry with exponential backoff for transient
 * errors (429, 500, 502, 503, 529).
 */

import { CLAUDE_MODEL_SONNET } from "./config";
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
  temperature?: number;
  timeoutMs?: number;
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

function isTimeoutError(err: unknown): boolean {
  return err instanceof DOMException && err.name === "TimeoutError";
}

/**
 * Call the Anthropic Messages API and return the raw text response.
 * Retries up to {@link MAX_RETRIES} times on transient errors and timeouts.
 * Throws {@link ClaudeApiError} on non-retryable non-2xx responses.
 */
export async function callClaude(options: ClaudeOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const reqBody: Record<string, unknown> = {
    model: options.model ?? CLAUDE_MODEL_SONNET,
    max_tokens: options.max_tokens,
    messages: options.messages,
  };
  if (options.system) reqBody.system = options.system;
  if (options.temperature !== undefined) reqBody.temperature = options.temperature;

  const headers = {
    "Content-Type": "application/json",
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
  };
  const bodyJson = JSON.stringify(reqBody);

  const effectiveTimeout = options.timeoutMs ?? CLAUDE_TIMEOUT_MS;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers,
        body: bodyJson,
        signal: AbortSignal.timeout(effectiveTimeout),
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "unknown");
        if (RETRYABLE_STATUSES.has(res.status) && attempt < MAX_RETRIES) {
          const delay = 1000 * Math.pow(2, attempt);
          log.warn(`[claude] ${res.status} on attempt ${attempt + 1}, retrying in ${delay}ms`);
          await new Promise((r) => setTimeout(r, delay));
          continue;
        }
        throw new ClaudeApiError(res.status, errText.slice(0, 300));
      }

      const data = await res.json();
      const text = (data.content?.[0]?.text as string) ?? "";
      if (!text) {
        log.warn("[claude] empty response text from API", { stop_reason: data.stop_reason });
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
