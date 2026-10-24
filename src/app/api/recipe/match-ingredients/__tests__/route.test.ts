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
  requireSupabaseAdmin: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/recipe/ingredient-matcher", () => ({
  matchAllIngredients: vi.fn(),
  checkPantry: vi.fn(),
  quantityNeeded: vi.fn(() => 1),
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
import { matchAllIngredients } from "@/lib/recipe/ingredient-matcher";
import { AiBudgetError } from "@/lib/api/ai-budget";

const BODY = {
  ingredients: [
    { name: "Milch", amount: 1, unit: "l", category: "dairy", notes: "", is_optional: false },
  ],
  aldi_mode: true,
  country: "DE",
  check_pantry: false,
};

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/recipe/match-ingredients", {
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

describe("POST /api/recipe/match-ingredients", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(requireSupabaseAdmin).mockReturnValue({} as never);
    vi.mocked(matchAllIngredients).mockResolvedValue([]);
    setCap(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when there is no session and does no matching", async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(401);
    expect(matchAllIngredients).not.toHaveBeenCalled();
  });

  it("returns 503 in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isRateLimitConfigured).mockReturnValue(false);
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(503);
    expect(matchAllIngredients).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid input without consuming quota", async () => {
    const res = await POST(makeRequest({ ...BODY, ingredients: [] }));
    expect(res.status).toBe(400);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-user/IP limit is hit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect(matchAllIngredients).not.toHaveBeenCalled();
  });

  it("returns 429 global_daily_cap when the global cap is hit", async () => {
    setCap(false);
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("global_daily_cap");
    expect(matchAllIngredients).not.toHaveBeenCalled();
  });

  it("returns 429 when the cap is reached during matching", async () => {
    vi.mocked(matchAllIngredients).mockRejectedValue(
      new AiBudgetError("global_daily_cap", 429, Date.now() + 1000),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
  });

  it("matches ingredients and applies user + IP limits (happy path)", async () => {
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ available: [], to_buy: [], unavailable: [] });
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "user:user-1");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "ip:test-ip");
  });

  it("returns 500 on an ordinary matcher failure", async () => {
    vi.mocked(matchAllIngredients).mockRejectedValue(new Error("db"));
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(500);
  });
});
