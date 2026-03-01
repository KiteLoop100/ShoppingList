/**
 * Shared Claude API client — eliminates duplicated fetch/parse/clean logic
 * across 7+ API route handlers (BL-33).
 */

import { CLAUDE_MODEL_SONNET } from "./config";
import { tryRepairTruncatedJson } from "@/lib/utils/repair-json";

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

/**
 * Call the Anthropic Messages API and return the raw text response.
 * Throws {@link ClaudeApiError} on non-2xx responses.
 */
export async function callClaude(options: ClaudeOptions): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not configured");

  const body: Record<string, unknown> = {
    model: options.model ?? CLAUDE_MODEL_SONNET,
    max_tokens: options.max_tokens,
    messages: options.messages,
  };
  if (options.system) body.system = options.system;
  if (options.temperature !== undefined) body.temperature = options.temperature;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new ClaudeApiError(res.status, errText.slice(0, 300));
  }

  const data = await res.json();
  return (data.content?.[0]?.text as string) ?? "";
}

/** Strip ```json ... ``` fences that Claude sometimes wraps around JSON output. */
export function cleanJsonFences(text: string): string {
  return text
    .replace(/^```json?\s*/i, "")
    .replace(/\s*```\s*$/i, "")
    .trim();
}

/**
 * Strip JSON fences, parse as T, and attempt truncated-JSON repair on failure.
 * Use when you already have raw Claude text (e.g. from a retry wrapper).
 */
export function parseClaudeJsonResponse<T>(raw: string): T {
  const cleaned = cleanJsonFences(raw);
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const repaired = tryRepairTruncatedJson(cleaned);
    if (repaired) {
      try {
        return JSON.parse(repaired) as T;
      } catch { /* fall through to final error */ }
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
