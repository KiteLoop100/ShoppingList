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

vi.mock("@/lib/categories/constants", () => ({
  loadDemandGroups: vi.fn().mockResolvedValue([]),
  loadDemandSubGroups: vi.fn().mockResolvedValue([]),
  buildDemandGroupsAndSubGroupsPrompt: vi.fn(() => ""),
}));

vi.mock("@/lib/receipts/parse-receipt", () => ({
  callReceiptOcr: vi.fn(),
  cleanupPhotos: vi.fn(),
  processValidReceipt: vi.fn(),
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
import { callReceiptOcr, processValidReceipt } from "@/lib/receipts/parse-receipt";
import { AiBudgetError } from "@/lib/api/ai-budget";

const BODY = { photo_urls: ["https://proj.supabase.co/storage/v1/object/public/r/a.jpg"] };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/process-receipt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeSupabase() {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  for (const m of ["insert", "select", "update", "eq"]) b[m] = vi.fn(chain);
  b.single = vi.fn(() => Promise.resolve({ data: { scan_id: "scan-1" }, error: null }));
  b.then = (resolve: (v: unknown) => void) => resolve({ error: null });
  return { from: vi.fn(() => b) };
}

function setCap(success: boolean) {
  const getRemaining = vi
    .fn()
    .mockResolvedValue({ remaining: success ? 5 : 0, limit: 200, reset: Date.now() + 60_000 });
  vi.mocked(getGlobalAiCapLimiter).mockReturnValue({ getRemaining } as never);
}

describe("POST /api/process-receipt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiKey).mockReturnValue("sk-test");
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(requireSupabaseAdmin).mockReturnValue(fakeSupabase() as never);
    vi.mocked(callReceiptOcr).mockResolvedValue({ status: "ok" } as never);
    vi.mocked(processValidReceipt).mockResolvedValue({ receipt_id: "r-1" } as never);
    setCap(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns 401 when there is no session and does no OCR", async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(401);
    expect(callReceiptOcr).not.toHaveBeenCalled();
  });

  it("returns 503 in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isRateLimitConfigured).mockReturnValue(false);
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(503);
    expect(callReceiptOcr).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid input without consuming quota", async () => {
    const res = await POST(makeRequest({ photo_urls: [] }));
    expect(res.status).toBe(400);
    expect(checkRateLimit).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-user/IP limit is hit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }),
    );
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect(callReceiptOcr).not.toHaveBeenCalled();
  });

  it("returns 429 global_daily_cap when the global cap is hit", async () => {
    setCap(false);
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("global_daily_cap");
    expect(callReceiptOcr).not.toHaveBeenCalled();
  });

  it("processes a receipt and streams the result (happy path)", async () => {
    const res = await POST(makeRequest(BODY));
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain("event: result");
    expect(text).toContain('"receipt_id":"r-1"');
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "user:user-1");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "ip:test-ip");
  });

  it("streams the cap error when the cap is reached during OCR", async () => {
    vi.mocked(callReceiptOcr).mockRejectedValue(
      new AiBudgetError("global_daily_cap", 429, Date.now() + 1000),
    );
    const res = await POST(makeRequest(BODY));
    const text = await res.text();
    expect(text).toContain("event: error");
    expect(text).toContain("global_daily_cap");
    expect(text).toContain('"status":429');
    expect(processValidReceipt).not.toHaveBeenCalled();
  });
});
