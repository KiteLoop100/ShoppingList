import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

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

vi.mock("@/lib/api/claude-client", () => ({ callClaudeJSON: vi.fn() }));

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
import {
  checkRateLimit,
  getGlobalAiCapLimiter,
  isRateLimitConfigured,
} from "@/lib/api/rate-limit";
import { callClaudeJSON } from "@/lib/api/claude-client";
import { loadInventory } from "@/lib/inventory/inventory-service";
import { AiBudgetError } from "@/lib/api/ai-budget";

const BODY = { message: "Was kann ich kochen?", conversation_history: [] };

const AI_REPLY = {
  type: "clarification",
  message: "Magst du es herzhaft?",
  suggestions: null,
  question: "Herzhaft oder süß?",
  recipe: null,
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/recipe/cook-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function tooMany() {
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
}

function setCap(success: boolean) {
  const getRemaining = vi
    .fn()
    .mockResolvedValue({ remaining: success ? 5 : 0, limit: 200, reset: Date.now() + 60_000 });
  vi.mocked(getGlobalAiCapLimiter).mockReturnValue({ getRemaining } as never);
}

describe("POST /api/recipe/cook-chat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(requireSupabaseAdmin).mockReturnValue({
      from: vi.fn(() => ({ insert: vi.fn().mockResolvedValue({ error: null }) })),
    } as never);
    vi.mocked(loadInventory).mockResolvedValue([{ name: "Eier" }] as never);
    vi.mocked(callClaudeJSON).mockResolvedValue(AI_REPLY);
    setCap(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("returns 401 when there is no session and calls no AI", async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(401);
    expect(callClaudeJSON).not.toHaveBeenCalled();
  });

  it("returns 503 in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isRateLimitConfigured).mockReturnValue(false);
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(503);
    expect(callClaudeJSON).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid input without consuming quota", async () => {
    const res = await POST(makeRequest({ message: "", conversation_history: [] }));
    expect(res.status).toBe(400);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when the shared per-user/IP limit is hit", async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (limiter) =>
      (limiter as { fake?: string }).fake === "claude" ? tooMany() : null,
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect(callClaudeJSON).not.toHaveBeenCalled();
  });

  it("keeps the existing 30/day recipe limit in addition", async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (limiter) =>
      (limiter as { fake?: string }).fake === "recipe-daily" ? tooMany() : null,
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).error).toContain("heute");
    expect(callClaudeJSON).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "recipe-daily" }, "user-1");
  });

  it("returns 429 global_daily_cap when the global cap is hit", async () => {
    setCap(false);
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("global_daily_cap");
    expect(callClaudeJSON).not.toHaveBeenCalled();
  });

  it("returns 429 when the cap is reached during the Claude call", async () => {
    vi.mocked(callClaudeJSON).mockRejectedValue(
      new AiBudgetError("global_daily_cap", 429, Date.now() + 1000),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("global_daily_cap");
  });

  it("does not spend any quota when the pantry is empty (no AI call)", async () => {
    vi.mocked(loadInventory).mockResolvedValue([]);
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(200);
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(callClaudeJSON).not.toHaveBeenCalled();
  });

  it("answers the chat and applies user + IP + daily limits (happy path)", async () => {
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.response.type).toBe("clarification");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "user:user-1");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "ip:test-ip");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "recipe-daily" }, "user-1");
    expect(callClaudeJSON).toHaveBeenCalledTimes(1);
  });
});
