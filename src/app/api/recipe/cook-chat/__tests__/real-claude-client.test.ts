/**
 * Regression: Cook Chat on the Claude 5.5 models.
 *
 * The other route tests mock `callClaudeJSON`, so nothing checked the request that
 * actually leaves the server. The new models answer HTTP 400
 * "`temperature` is deprecated for this model." and the UI showed "Connection error".
 *
 * Here the REAL route and the REAL Claude client run against a fake Anthropic API
 * that enforces those rules, and also answers the way the new models do
 * (thinking block first, prose and a markdown fence around the JSON).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  claudeRateLimit: { fake: "claude" },
  recipeAiDailyRateLimit: { fake: "recipe-daily" },
  checkRateLimit: vi.fn(),
  getIdentifier: vi.fn((_req: Request, userId?: string) => userId ?? "test-ip"),
  isRateLimitConfigured: vi.fn(() => true),
  getGlobalAiCapLimiter: vi.fn(),
}));

vi.mock("@/lib/api/guards", () => ({
  requireSupabaseAdmin: vi.fn(),
  requireAuth: vi.fn(),
}));

// Keep the real budget module (ai-guard needs its exports); only skip the Upstash counter.
vi.mock("@/lib/api/ai-budget", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api/ai-budget")>()),
  consumeGlobalAiCall: vi.fn(),
}));

vi.mock("@/lib/inventory/inventory-service", () => ({ loadInventory: vi.fn() }));
vi.mock("@/lib/recipe/ingredient-matcher-catalog", () => ({
  getRelevantProducts: vi.fn().mockResolvedValue([]),
}));
vi.mock("@/lib/recipe/cook-prompts", () => ({
  buildCookSystemPrompt: vi.fn(() => "system"),
  COOK_JSON_RETRY_USER: "retry as json",
  cookMessageToClaudeText: vi.fn((m: { content: string }) => m.content),
  formatCatalogForPrompt: vi.fn(() => "catalog"),
  formatPantryForPrompt: vi.fn(() => "pantry"),
  resolveCatalogCountry: vi.fn().mockResolvedValue("DE"),
}));
vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { POST } from "../route";
import { requireSupabaseAdmin, requireAuth } from "@/lib/api/guards";
import { checkRateLimit, getGlobalAiCapLimiter } from "@/lib/api/rate-limit";
import { loadInventory } from "@/lib/inventory/inventory-service";
import { CLAUDE_MODEL_MAIN } from "@/lib/api/config";

const REPLY = {
  type: "clarification",
  message: "Magst du es scharf?",
  suggestions: null,
  question: "Mit oder ohne Chili?",
  recipe: null,
};

/** Fields the new models no longer accept. The real API answers 400 for each. */
const REJECTED_FIELDS = ["temperature", "top_p", "top_k"] as const;

function anthropicError(message: string) {
  const body = { type: "error", error: { type: "invalid_request_error", message } };
  return {
    ok: false,
    status: 400,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

function anthropicOk(content: unknown[]) {
  const body = { content, stop_reason: "end_turn" };
  return {
    ok: true,
    status: 200,
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(JSON.stringify(body)),
  };
}

/** Fake Anthropic Messages API: strict about the request, new-model style in the response. */
function strictAnthropic() {
  return vi.fn(async (_url: unknown, init: { body: string }) => {
    const body = JSON.parse(init.body) as Record<string, unknown>;
    for (const field of REJECTED_FIELDS) {
      if (field in body) return anthropicError(`\`${field}\` is deprecated for this model.`);
    }
    if (typeof body.model !== "string" || !body.model.startsWith("claude-")) {
      return anthropicError("model: unknown");
    }
    if (!Number.isInteger(body.max_tokens) || (body.max_tokens as number) < 1) {
      return anthropicError("max_tokens: must be a positive integer");
    }
    return anthropicOk([
      { type: "thinking", thinking: "Der Nutzer möchte Pasta ..." },
      { type: "text", text: `Hier ist meine Antwort:\n\`\`\`json\n${JSON.stringify(REPLY)}\n\`\`\`\nGuten Appetit!` },
    ]);
  });
}

function makeRequest(message: string): Request {
  return new Request("http://localhost/api/recipe/cook-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, conversation_history: [] }),
  });
}

describe("POST /api/recipe/cook-chat with the real Claude client", () => {
  let fetchMock: ReturnType<typeof strictAnthropic>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.stubEnv("ANTHROPIC_API_KEY", "test-key");
    fetchMock = strictAnthropic();
    vi.stubGlobal("fetch", fetchMock);

    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(requireSupabaseAdmin).mockReturnValue({
      from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
    } as never);
    vi.mocked(loadInventory).mockResolvedValue([{ name: "Spaghetti" }] as never);
    vi.mocked(getGlobalAiCapLimiter).mockReturnValue({
      getRemaining: vi.fn().mockResolvedValue({ remaining: 5, limit: 200, reset: Date.now() + 60_000 }),
    } as never);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("answers 200 for 'Pasta mit Tomaten und Knoblauch' (the failing preview message)", async () => {
    const res = await POST(makeRequest("Pasta mit Tomaten und Knoblauch"));

    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.response.type).toBe("clarification");
    expect(json.response.question).toBe("Mit oder ohne Chili?");
  });

  it("sends no sampling parameters and the configured main model", async () => {
    await POST(makeRequest("Pasta mit Tomaten und Knoblauch"));

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const sent = JSON.parse((fetchMock.mock.calls[0][1] as { body: string }).body) as Record<string, unknown>;
    for (const field of REJECTED_FIELDS) expect(sent).not.toHaveProperty(field);
    expect(sent.model).toBe(CLAUDE_MODEL_MAIN);
    expect(sent.max_tokens).toBeGreaterThan(0);
  });
});
