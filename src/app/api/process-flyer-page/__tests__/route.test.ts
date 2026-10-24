import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  generalRateLimit: { fake: "general" },
  flyerRateLimit: { fake: "flyer" },
  checkRateLimit: vi.fn(),
  getIdentifier: vi.fn(() => "test-ip"),
  isRateLimitConfigured: vi.fn(() => true),
  getGlobalAiCapLimiter: vi.fn(),
}));

vi.mock("@/lib/api/guards", () => ({
  requireApiKey: vi.fn(),
  requireSupabaseAdmin: vi.fn(),
  requireAuth: vi.fn(),
  isAdminRequest: vi.fn(() => false),
}));

vi.mock("@/lib/api/claude-client", () => ({ callClaudeJSON: vi.fn() }));

vi.mock("@/lib/categories/constants", () => ({
  loadDemandGroups: vi.fn().mockResolvedValue([]),
  loadDemandSubGroups: vi.fn().mockResolvedValue([]),
  buildDemandGroupsAndSubGroupsPrompt: vi.fn(() => ""),
}));

vi.mock("@/lib/api/photo-processing/prompts", () => ({
  buildFlyerPdfPagePrompt: vi.fn(() => "prompt"),
}));

vi.mock("@/lib/api/photo-processing/gemini-detect", () => ({
  detectProductBoxes: vi.fn().mockResolvedValue([]),
  matchBboxesToProducts: vi.fn(() => new Map()),
}));

vi.mock("@/lib/products/open-food-facts", () => ({ fetchOpenFoodFacts: vi.fn() }));
vi.mock("@/lib/products/find-existing", () => ({
  findExistingProduct: vi.fn().mockResolvedValue(null),
}));
vi.mock("@/lib/products/upsert-product", () => ({
  upsertProduct: vi.fn().mockResolvedValue({ product_id: "prod-1" }),
}));
vi.mock("@/lib/products/default-category", () => ({
  getDefaultDemandGroupCode: vi.fn(() => "DG"),
  getAktionsartikelDemandGroupCode: vi.fn(() => "AK"),
}));
vi.mock("@/lib/products/demand-group-fallback", () => ({
  getDemandGroupFallback: vi.fn(() => null),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { POST, maxDuration } from "../route";
import {
  requireApiKey,
  requireSupabaseAdmin,
  requireAuth,
  isAdminRequest,
} from "@/lib/api/guards";
import {
  checkRateLimit,
  getGlobalAiCapLimiter,
  isRateLimitConfigured,
} from "@/lib/api/rate-limit";
import { callClaudeJSON } from "@/lib/api/claude-client";

const BODY = { upload_id: "up-1", flyer_id: "fl-1", page_number: 2 };
const SUPABASE_URL = "https://proj123.supabase.co";
const PAGE_PDF_URL = `${SUPABASE_URL}/storage/v1/object/public/flyer-pages/fl-1/page-2.pdf`;

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/process-flyer-page", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function uploadRow(overrides: Record<string, unknown> = {}) {
  return {
    upload_id: "up-1",
    user_id: "user-1",
    status: "processing",
    products_created: 0,
    products_updated: 0,
    extracted_data: { flyer_id: "fl-1", total_pages: 3, pages_processed: 1 },
    ...overrides,
  };
}

/** Table-aware chainable supabase fake. */
function fakeSupabase(upload: unknown, pageImageUrl: string = PAGE_PDF_URL) {
  const singles: Record<string, unknown> = {
    photo_uploads: { data: upload, error: null },
    flyers: { data: { country: "DE" }, error: null },
    flyer_pages: {
      data: { page_id: "pg-1", image_url: pageImageUrl },
      error: null,
    },
  };
  const from = vi.fn((table: string) => {
    const b: Record<string, unknown> = {};
    const chain = () => b;
    for (const m of ["select", "update", "eq", "delete", "upsert"]) b[m] = vi.fn(chain);
    b.single = vi.fn(() => Promise.resolve(singles[table] ?? { data: null, error: null }));
    b.then = (resolve: (v: unknown) => void) => resolve({ error: null });
    return b;
  });
  return { from };
}

function setCap(success: boolean) {
  // Route guards only peek at the global cap (the real count happens in callClaude).
  const limit = vi.fn().mockResolvedValue({ remaining: success ? 5 : 0, limit: 200, reset: Date.now() + 60_000 });
  vi.mocked(getGlobalAiCapLimiter).mockReturnValue({ getRemaining: limit } as never);
}

describe("POST /api/process-flyer-page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
    vi.mocked(requireApiKey).mockReturnValue("sk-test");
    vi.mocked(isAdminRequest).mockReturnValue(false);
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    setCap(true);
    vi.mocked(requireSupabaseAdmin).mockReturnValue(fakeSupabase(uploadRow()) as never);
    vi.mocked(callClaudeJSON).mockResolvedValue({ products: [] });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) }),
    );
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("exports maxDuration 300 so long Claude PDF calls are not cut off at the default", () => {
    expect(maxDuration).toBe(300);
  });

  it("returns 401 when there is no session and does no work", async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(401);
    expect(callClaudeJSON).not.toHaveBeenCalled();
    expect(requireSupabaseAdmin).not.toHaveBeenCalled();
  });

  it("returns 503 in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isRateLimitConfigured).mockReturnValue(false);
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(503);
    expect(callClaudeJSON).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/process-flyer-page", {
      method: "POST",
      body: "nope",
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("returns 400 for invalid input without consuming quota", async () => {
    const res = await POST(makeRequest({ ...BODY, page_number: 0 }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid input");
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

  it("returns 404 when the upload belongs to another user (anonymous non-admin)", async () => {
    vi.mocked(requireSupabaseAdmin).mockReturnValue(
      fakeSupabase(uploadRow({ user_id: "someone-else" })) as never,
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(404);
    expect(callClaudeJSON).not.toHaveBeenCalled();
  });

  describe("admin access", () => {
    it("lets the admin continue another user's upload (cross-device continuation)", async () => {
      vi.mocked(isAdminRequest).mockReturnValue(true);
      vi.mocked(requireSupabaseAdmin).mockReturnValue(
        fakeSupabase(uploadRow({ user_id: "someone-else" })) as never,
      );
      const res = await POST(makeRequest(BODY));
      expect(res.status).toBe(200);
      expect(callClaudeJSON).toHaveBeenCalledTimes(1);
    });

    it("lets the admin call without a Supabase session (reprocess script) and limits as 'admin'", async () => {
      vi.mocked(isAdminRequest).mockReturnValue(true);
      vi.mocked(requireAuth).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const res = await POST(makeRequest(BODY));
      expect(res.status).toBe(200);
      expect(checkRateLimit).toHaveBeenCalledWith({ fake: "general" }, "user:admin");
      expect(checkRateLimit).toHaveBeenCalledWith({ fake: "flyer" }, "user:admin");
    });

    it("still fails closed (503) for the admin when Upstash is missing in production", async () => {
      vi.mocked(isAdminRequest).mockReturnValue(true);
      vi.stubEnv("NODE_ENV", "production");
      vi.mocked(isRateLimitConfigured).mockReturnValue(false);
      const res = await POST(makeRequest(BODY));
      expect(res.status).toBe(503);
      expect(callClaudeJSON).not.toHaveBeenCalled();
    });

    it("admin cookie does not waive a 500 from requireAuth (auth misconfigured)", async () => {
      vi.mocked(isAdminRequest).mockReturnValue(true);
      vi.mocked(requireAuth).mockResolvedValue(
        NextResponse.json({ error: "Auth not configured" }, { status: 500 }),
      );
      expect((await POST(makeRequest(BODY))).status).toBe(500);
    });
  });

  describe("limiters", () => {
    it("applies burst (general) AND hourly flyer limiter, each per user and per IP", async () => {
      await POST(makeRequest(BODY));
      expect(checkRateLimit).toHaveBeenCalledWith({ fake: "general" }, "user:user-1");
      expect(checkRateLimit).toHaveBeenCalledWith({ fake: "general" }, "ip:test-ip");
      expect(checkRateLimit).toHaveBeenCalledWith({ fake: "flyer" }, "user:user-1");
      expect(checkRateLimit).toHaveBeenCalledWith({ fake: "flyer" }, "ip:test-ip");
    });

    it("returns 429 when only the hourly flyer limiter is hit", async () => {
      vi.mocked(checkRateLimit).mockImplementation(async (limiter) =>
        (limiter as { fake?: string }).fake === "flyer"
          ? NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
          : null,
      );
      const res = await POST(makeRequest(BODY));
      expect(res.status).toBe(429);
      expect(callClaudeJSON).not.toHaveBeenCalled();
    });
  });

  describe("page PDF URL (SSRF)", () => {
    it.each([
      ["foreign host", "https://cdn.example.com/page2.pdf"],
      ["non-public path on our host", `${SUPABASE_URL}/rest/v1/flyer_pages`],
      ["plain http", PAGE_PDF_URL.replace("https:", "http:")],
      ["private IP", "https://10.0.0.1/storage/v1/object/public/flyer-pages/x.pdf"],
    ])("returns 400 and never fetches for %s", async (_label, url) => {
      vi.mocked(requireSupabaseAdmin).mockReturnValue(fakeSupabase(uploadRow(), url) as never);
      const res = await POST(makeRequest(BODY));
      expect(res.status).toBe(400);
      expect(fetch).not.toHaveBeenCalled();
      expect(callClaudeJSON).not.toHaveBeenCalled();
    });

    it("fetches a valid storage URL with redirect: 'error'", async () => {
      await POST(makeRequest(BODY));
      expect(fetch).toHaveBeenCalledWith(PAGE_PDF_URL, { redirect: "error" });
    });
  });

  it("returns 404 when the upload does not exist", async () => {
    vi.mocked(requireSupabaseAdmin).mockReturnValue(fakeSupabase(null) as never);
    expect((await POST(makeRequest(BODY))).status).toBe(404);
  });

  it("returns 400 when the upload is not associated with the flyer", async () => {
    const res = await POST(makeRequest({ ...BODY, flyer_id: "other-flyer" }));
    expect(res.status).toBe(400);
    expect(callClaudeJSON).not.toHaveBeenCalled();
  });

  it("processes a page: calls Claude with a 150 s timeout and general limiter", async () => {
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, page_number: 2, total_pages: 3, completed: false });

    expect(callClaudeJSON).toHaveBeenCalledTimes(1);
    expect(vi.mocked(callClaudeJSON).mock.calls[0][0]).toMatchObject({ timeoutMs: 150_000 });
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "general" }, "user:user-1");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "general" }, "ip:test-ip");
  });

  it("creates products from the Claude result", async () => {
    vi.mocked(callClaudeJSON).mockResolvedValue({
      products: [{ name: "Butter 250g", price: 1.99 }],
    });
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ products_created: 1, products_updated: 0 });
  });

  it("skips already processed pages without calling Claude", async () => {
    const res = await POST(makeRequest({ ...BODY, page_number: 1 }));
    expect(res.status).toBe(200);
    expect((await res.json()).skipped).toBe(true);
    expect(callClaudeJSON).not.toHaveBeenCalled();
  });

  it("returns 502 when Claude fails", async () => {
    vi.mocked(callClaudeJSON).mockRejectedValue(new Error("timeout"));
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(502);
  });
});
