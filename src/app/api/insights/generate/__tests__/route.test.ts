import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  claudeRateLimit: { fake: "claude" },
  checkRateLimit: vi.fn(),
  getIdentifier: vi.fn(() => "test-ip"),
  isRateLimitConfigured: vi.fn(() => true),
  getGlobalAiCapLimiter: vi.fn(),
}));

vi.mock("@/lib/api/guards", () => ({
  requireApiKey: vi.fn(),
  requireSupabaseAdmin: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/api/claude-client", () => ({ callClaudeJSON: vi.fn() }));

vi.mock("@/lib/insights/context-assembler", () => ({
  assembleInsightContext: vi.fn().mockResolvedValue({}),
}));
vi.mock("@/lib/insights/format-context", () => ({
  formatContextForPrompt: vi.fn(() => "ctx"),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { POST } from "../route";
import { requireApiKey, requireSupabaseAdmin, requireAuth } from "@/lib/api/guards";
import {
  checkRateLimit,
  getGlobalAiCapLimiter,
  isRateLimitConfigured,
} from "@/lib/api/rate-limit";
import { callClaudeJSON } from "@/lib/api/claude-client";
import { AiBudgetError } from "@/lib/api/ai-budget";

const BODY = { topic: "savings", locale: "de" };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/insights/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setCap(success: boolean) {
  const getRemaining = vi
    .fn()
    .mockResolvedValue({ remaining: success ? 5 : 0, limit: 200, reset: Date.now() + 60_000 });
  vi.mocked(getGlobalAiCapLimiter).mockReturnValue({ getRemaining } as never);
}

describe("POST /api/insights/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiKey).mockReturnValue("sk-test");
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(requireSupabaseAdmin).mockReturnValue({} as never);
    vi.mocked(callClaudeJSON).mockResolvedValue({
      title: "Sparen",
      sections: [{ content: "Tipp" }],
      summary: "Kurz",
      follow_up_suggestions: [],
    });
    setCap(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
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
    const res = await POST(makeRequest({ topic: "nope", locale: "de" }));
    expect(res.status).toBe(400);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-user/IP limit is hit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect(callClaudeJSON).not.toHaveBeenCalled();
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

  it("generates an insight and applies user + IP limits (happy path)", async () => {
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(200);
    expect((await res.json()).title).toBe("Sparen");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "user:user-1");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "ip:test-ip");
  });

  it("returns 500 when the model output is invalid", async () => {
    vi.mocked(callClaudeJSON).mockResolvedValue({ nonsense: true });
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(500);
  });
});
