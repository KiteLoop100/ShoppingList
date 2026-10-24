import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  claudeRateLimit: { fake: "claude" },
  recipeExtractRateLimit: { fake: "recipe-extract" },
  checkRateLimit: vi.fn(),
  getIdentifier: vi.fn((_req: Request, userId?: string) => userId ?? "test-ip"),
  isRateLimitConfigured: vi.fn(() => true),
  getGlobalAiCapLimiter: vi.fn(),
}));

vi.mock("@/lib/api/guards", () => ({
  requireSupabaseAdmin: vi.fn(),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/recipe/extract", () => ({ extractRecipe: vi.fn() }));

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
import { extractRecipe } from "@/lib/recipe/extract";
import { AiBudgetError } from "@/lib/api/ai-budget";

const BODY = { url: "https://example.com/rezept" };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/recipe/extract", {
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

describe("POST /api/recipe/extract", () => {
  let insert: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    insert = vi.fn().mockResolvedValue({ error: null });
    vi.mocked(requireSupabaseAdmin).mockReturnValue({ from: vi.fn(() => ({ insert })) } as never);
    vi.mocked(extractRecipe).mockResolvedValue({
      recipe: { title: "Kuchen" },
      method: "json-ld",
    } as never);
    setCap(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when there is no session and extracts nothing", async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(401);
    expect(extractRecipe).not.toHaveBeenCalled();
  });

  it("returns 503 in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isRateLimitConfigured).mockReturnValue(false);
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(503);
    expect(extractRecipe).not.toHaveBeenCalled();
  });

  it("returns 400 for an invalid URL without consuming quota", async () => {
    const res = await POST(makeRequest({ url: "ftp://nope" }));
    expect(res.status).toBe(400);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when the shared per-user/IP limit is hit", async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (limiter) =>
      (limiter as { fake?: string }).fake === "claude" ? tooMany() : null,
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect(extractRecipe).not.toHaveBeenCalled();
  });

  it("keeps the existing recipe-extract daily limit in addition", async () => {
    vi.mocked(checkRateLimit).mockImplementation(async (limiter) =>
      (limiter as { fake?: string }).fake === "recipe-extract" ? tooMany() : null,
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect(extractRecipe).not.toHaveBeenCalled();
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "recipe-extract" }, "user-1");
  });

  it("returns 429 global_daily_cap when the global cap is hit", async () => {
    setCap(false);
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("global_daily_cap");
    expect(extractRecipe).not.toHaveBeenCalled();
  });

  it("returns 429 (and logs no failed import) when the cap is hit during extraction", async () => {
    vi.mocked(extractRecipe).mockRejectedValue(
      new AiBudgetError("global_daily_cap", 429, Date.now() + 1000),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect(insert).not.toHaveBeenCalled();
  });

  describe("SSRF rejections are reported as 400 and logged as a fetch-stage failure", () => {
    it.each([
      ["http://localhost/rezept", 'URL protocol must be https (got "http:")'],
      ["http://169.254.169.254/latest/meta-data", 'URL protocol must be https (got "http:")'],
      ["https://10.0.0.1/", 'URL hostname "10.0.0.1" resolves to a private or reserved IP range'],
    ])("%s → 400", async (url, detail) => {
      // extractRecipe (real impl, tested in lib/recipe/__tests__/extract-fetch) throws UnsafeUrlError.
      vi.mocked(extractRecipe).mockRejectedValue(new Error(`Unsafe URL: ${detail}`));
      const res = await POST(makeRequest({ url }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toMatch(/nur öffentliche https/);
      expect(insert).toHaveBeenCalledWith(
        expect.objectContaining({ success: false, extraction_method: "json-ld" }),
      );
    });

    it("maps a redirect to a private IP (rejected mid-chain) to 400", async () => {
      vi.mocked(extractRecipe).mockRejectedValue(
        new Error('Unsafe URL: URL hostname "10.0.0.1" resolves to a private or reserved IP range'),
      );
      const res = await POST(makeRequest(BODY));
      expect(res.status).toBe(400);
    });

    it("maps too many redirects to 400", async () => {
      vi.mocked(extractRecipe).mockRejectedValue(new Error("Too many redirects (max 3)"));
      expect((await POST(makeRequest(BODY))).status).toBe(400);
    });
  });

  it("extracts a recipe and applies user + IP + recipe limits (happy path)", async () => {
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ method: "json-ld", recipe: { title: "Kuchen" } });
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "user:user-1");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "ip:test-ip");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "recipe-extract" }, "user-1");
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});
