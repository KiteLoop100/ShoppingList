import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import {
  callClaude,
  callClaudeJSON,
  ClaudeApiError,
  extractFirstBalancedJsonValue,
  parseClaudeJsonResponse,
} from "../claude-client";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/utils/repair-json", () => ({
  tryRepairTruncatedJson: vi.fn(() => null),
}));

const VALID_OPTIONS = {
  max_tokens: 100,
  messages: [{ role: "user" as const, content: "Hello" }],
};

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe("callClaude", () => {
  test("returns text from successful response", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ content: [{ text: "Hello back" }] }),
    );

    const result = await callClaude(VALID_OPTIONS);
    expect(result).toBe("Hello back");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("throws when ANTHROPIC_API_KEY is missing", async () => {
    vi.stubEnv("ANTHROPIC_API_KEY", "");
    await expect(callClaude(VALID_OPTIONS)).rejects.toThrow("ANTHROPIC_API_KEY not configured");
  });

  test("throws ClaudeApiError on non-retryable error (400)", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ error: "bad request" }, 400),
    );

    await expect(callClaude(VALID_OPTIONS)).rejects.toThrow(ClaudeApiError);
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  test("retries on 429 and succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: "rate limited" }, 429))
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ text: "ok" }] }),
      );

    const result = await callClaude(VALID_OPTIONS);
    expect(result).toBe("ok");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("retries on 500 and succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: "server error" }, 500))
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ text: "recovered" }] }),
      );

    const result = await callClaude(VALID_OPTIONS);
    expect(result).toBe("recovered");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("retries on 529 (overloaded) and succeeds", async () => {
    mockFetch
      .mockResolvedValueOnce(jsonResponse({ error: "overloaded" }, 529))
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ text: "recovered" }] }),
      );

    const result = await callClaude(VALID_OPTIONS);
    expect(result).toBe("recovered");
  });

  test(
    "throws after exhausting retries on persistent 429",
    async () => {
      mockFetch
        .mockResolvedValue(jsonResponse({ error: "rate limited" }, 429));

      await expect(callClaude(VALID_OPTIONS)).rejects.toThrow(ClaudeApiError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    },
    10_000,
  );

  test("retries on timeout and succeeds", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError");
    mockFetch
      .mockRejectedValueOnce(timeoutError)
      .mockResolvedValueOnce(
        jsonResponse({ content: [{ text: "after timeout" }] }),
      );

    const result = await callClaude(VALID_OPTIONS);
    expect(result).toBe("after timeout");
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  test("throws after exhausting retries on persistent timeout", async () => {
    const timeoutError = new DOMException("signal timed out", "TimeoutError");
    mockFetch.mockRejectedValue(timeoutError);

    await expect(callClaude(VALID_OPTIONS)).rejects.toThrow("timeout");
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  test("returns empty string when response has no text content", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ content: [] }),
    );

    const result = await callClaude(VALID_OPTIONS);
    expect(result).toBe("");
  });

  test("passes AbortSignal.timeout to fetch", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ content: [{ text: "ok" }] }),
    );

    await callClaude(VALID_OPTIONS);

    const fetchCall = mockFetch.mock.calls[0][1];
    expect(fetchCall.signal).toBeDefined();
  });
});

describe("callClaudeJSON", () => {
  test("parses JSON response", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ content: [{ text: '{"name": "Test"}' }] }),
    );

    const result = await callClaudeJSON<{ name: string }>(VALID_OPTIONS);
    expect(result.name).toBe("Test");
  });

  test("strips JSON fences before parsing", async () => {
    mockFetch.mockResolvedValueOnce(
      jsonResponse({ content: [{ text: '```json\n{"name": "Test"}\n```' }] }),
    );

    const result = await callClaudeJSON<{ name: string }>(VALID_OPTIONS);
    expect(result.name).toBe("Test");
  });
});

describe("parseClaudeJsonResponse", () => {
  test("parses valid JSON", () => {
    const result = parseClaudeJsonResponse<{ a: number }>('{"a": 1}');
    expect(result.a).toBe(1);
  });

  test("strips json fences", () => {
    const result = parseClaudeJsonResponse<{ a: number }>('```json\n{"a": 1}\n```');
    expect(result.a).toBe(1);
  });

  test("throws on unparseable content", () => {
    expect(() => parseClaudeJsonResponse("not json")).toThrow("Failed to parse");
  });

  test("parses JSON when markdown fence and trailing explanation follow the object", () => {
    const raw = [
      "```json",
      '{ "demand_group_code": "54", "note": "x" }',
      "```",
      "",
      "**Begründung:** Muskat ist ein Gewürz...",
    ].join("\n");

    const result = parseClaudeJsonResponse<{ demand_group_code: string; note: string }>(raw);
    expect(result.demand_group_code).toBe("54");
    expect(result.note).toBe("x");
  });

  test("parses JSON array when prose follows the closing bracket", () => {
    const raw = '[1, 2, 3]\n\nSee above.';
    const result = parseClaudeJsonResponse<number[]>(raw);
    expect(result).toEqual([1, 2, 3]);
  });

  test("does not treat braces inside JSON strings as structure", () => {
    const raw = '{"msg": "use { or } carefully"} then more text';
    const result = parseClaudeJsonResponse<{ msg: string }>(raw);
    expect(result.msg).toBe("use { or } carefully");
  });
});

describe("extractFirstBalancedJsonValue", () => {
  test("returns null when no object or array", () => {
    expect(extractFirstBalancedJsonValue("no brackets")).toBeNull();
  });
});
