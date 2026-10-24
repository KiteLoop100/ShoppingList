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
  isAdminRequest: vi.fn(() => false),
  adminOnlyResponse: () =>
    NextResponse.json({ error: "Flyer processing requires admin access" }, { status: 403 }),
}));

vi.mock("@/lib/api/photo-processing/image-utils", () => ({
  fetchAndPreprocessImage: vi.fn(),
}));

vi.mock("@/lib/api/photo-processing/process-data-extraction", () => ({
  processDataExtraction: vi.fn(),
}));

vi.mock("@/lib/api/photo-processing/process-flyer", () => ({
  processFlyer: vi.fn(),
}));

vi.mock("@/lib/api/photo-processing/process-product-photo", () => ({
  processVisionPhoto: vi.fn(() => NextResponse.json({ ok: true })),
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
import { fetchAndPreprocessImage } from "@/lib/api/photo-processing/image-utils";
import { processFlyer } from "@/lib/api/photo-processing/process-flyer";

const SUPABASE_URL = "https://proj123.supabase.co";
const PHOTO_URL = `${SUPABASE_URL}/storage/v1/object/public/product-photos/u/p.jpg`;
const VALID_BODY = { upload_id: "abc-123", photo_url: PHOTO_URL };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/process-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

/** Chainable supabase fake: select→maybeSingle returns `upload`, updates succeed. */
function fakeSupabase(
  upload: { upload_id: string; user_id: string } | null,
  lookupError: { message: string } | null = null,
) {
  const builder: Record<string, unknown> = {};
  const chain = vi.fn(() => builder);
  builder.select = chain;
  builder.update = chain;
  builder.eq = chain;
  builder.lt = vi.fn(() => Promise.resolve({ error: null }));
  builder.maybeSingle = vi.fn(() => Promise.resolve({ data: upload, error: lookupError }));
  builder.then = (resolve: (v: unknown) => void) => resolve({ error: null });
  return { from: vi.fn(() => builder), builder };
}

function setCap(success: boolean) {
  // Route guards only peek at the global cap (the real count happens in callClaude).
  const limit = vi.fn().mockResolvedValue({ remaining: success ? 5 : 0, limit: 200, reset: Date.now() + 60_000 });
  vi.mocked(getGlobalAiCapLimiter).mockReturnValue({ getRemaining: limit } as never);
  return limit;
}

describe("POST /api/process-photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", SUPABASE_URL);
    vi.mocked(requireApiKey).mockReturnValue("sk-test");
    vi.mocked(isAdminRequest).mockReturnValue(false);
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    setCap(true);

    const sb = fakeSupabase({ upload_id: "abc-123", user_id: "user-1" });
    vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);

    vi.mocked(fetchAndPreprocessImage).mockResolvedValue({
      imageBase64: "base64data",
      mediaType: "image/jpeg",
      imageBuffer: Buffer.from("test"),
      isPdf: false,
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("exports maxDuration 300 (PDF flyers run page by page)", () => {
    expect(maxDuration).toBe(300);
  });

  describe("authentication", () => {
    it("returns 401 when there is no session and does no work", async () => {
      vi.mocked(requireAuth).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(401);
      expect(fetchAndPreprocessImage).not.toHaveBeenCalled();
      expect(requireSupabaseAdmin).not.toHaveBeenCalled();
    });

    it("returns 503 in production when Upstash is not configured", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.mocked(isRateLimitConfigured).mockReturnValue(false);
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(503);
      expect(fetchAndPreprocessImage).not.toHaveBeenCalled();
    });

    it("returns 500 when API key is not configured", async () => {
      vi.mocked(requireApiKey).mockReturnValue(
        NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 }),
      );
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(500);
    });
  });

  describe("validation", () => {
    it("returns 400 when upload_id is missing", async () => {
      const res = await POST(makeRequest({ photo_url: PHOTO_URL }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Invalid input");
    });

    it("returns 400 when upload_id is empty string", async () => {
      const res = await POST(makeRequest({ upload_id: "", photo_url: PHOTO_URL }));
      expect(res.status).toBe(400);
    });

    it("returns 400 when photo_url is not a valid URL", async () => {
      const res = await POST(makeRequest({ upload_id: "abc-123", photo_url: "not-a-url" }));
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Invalid input");
    });

    it("returns 400 when body is invalid JSON", async () => {
      const req = new Request("http://localhost/api/process-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json at all",
      });
      const res = await POST(req);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBe("Invalid JSON");
    });

    it("does not consume rate-limit quota for invalid input", async () => {
      await POST(makeRequest({ upload_id: "", photo_url: PHOTO_URL }));
      expect(checkRateLimit).not.toHaveBeenCalled();
    });
  });

  describe("photo_url SSRF / host restriction", () => {
    it.each([
      ["foreign host", "https://example.com/storage/v1/object/public/a.jpg"],
      ["other supabase project", "https://other.supabase.co/storage/v1/object/public/a.jpg"],
      ["non-storage path", `${SUPABASE_URL}/rest/v1/photo_uploads`],
      ["cloud metadata IP", "https://169.254.169.254/latest/meta-data"],
      ["plain http", PHOTO_URL.replace("https:", "http:")],
      ["localhost", "https://localhost/storage/v1/object/public/a.jpg"],
    ])("returns 400 and never fetches for %s", async (_label, url) => {
      const res = await POST(makeRequest({ upload_id: "abc-123", photo_url: url }));
      expect(res.status).toBe(400);
      expect(fetchAndPreprocessImage).not.toHaveBeenCalled();
    });
  });

  describe("rate limits", () => {
    it("returns 429 when the per-user/IP limit is hit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue(
        NextResponse.json({ error: "Rate limit exceeded. Try again later." }, { status: 429 }),
      );
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(429);
      expect(fetchAndPreprocessImage).not.toHaveBeenCalled();
    });

    it("returns 429 global_daily_cap when the global cap is hit", async () => {
      setCap(false);
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(429);
      expect((await res.json()).code).toBe("global_daily_cap");
      expect(fetchAndPreprocessImage).not.toHaveBeenCalled();
    });
  });

  describe("upload ownership", () => {
    it("returns 404 when the upload belongs to another user", async () => {
      const sb = fakeSupabase({ upload_id: "abc-123", user_id: "someone-else" });
      vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(404);
      expect(fetchAndPreprocessImage).not.toHaveBeenCalled();
    });

    it("returns 404 when the upload does not exist (same response, no probing)", async () => {
      const sb = fakeSupabase(null);
      vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(404);
    });

    it("returns 500 when the ownership lookup fails", async () => {
      const sb = fakeSupabase(null, { message: "db down" });
      vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(500);
      expect(fetchAndPreprocessImage).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    it("processes the caller's own upload from our storage", async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
      expect(fetchAndPreprocessImage).toHaveBeenCalledWith(PHOTO_URL, undefined);
    });

    it("applies per-user and per-IP limits with the claude limiter", async () => {
      await POST(makeRequest(VALID_BODY));
      expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "user:user-1");
      expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "ip:test-ip");
    });

    it("routes admin PDF uploads to processFlyer", async () => {
      vi.mocked(isAdminRequest).mockReturnValue(true);
      vi.mocked(processFlyer).mockResolvedValue(NextResponse.json({ ok: true }));
      vi.mocked(fetchAndPreprocessImage).mockResolvedValue({
        imageBase64: "x",
        mediaType: "application/pdf",
        imageBuffer: Buffer.from("pdf"),
        isPdf: true,
        pdfBuf: new ArrayBuffer(8),
      } as never);
      const res = await POST(makeRequest({ ...VALID_BODY, is_pdf: true }));
      expect(res.status).toBe(200);
      expect(fetchAndPreprocessImage).toHaveBeenCalledWith(PHOTO_URL, true);
      expect(processFlyer).toHaveBeenCalledTimes(1);
    });

    it("scopes the stale-upload sweep to the caller's user_id", async () => {
      const sb = fakeSupabase({ upload_id: "abc-123", user_id: "user-1" });
      vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);
      await POST(makeRequest(VALID_BODY));
      expect(sb.builder.eq).toHaveBeenCalledWith("user_id", "user-1");
      expect(sb.builder.eq).toHaveBeenCalledWith("status", "processing");
    });
  });

  describe("flyer import is admin only", () => {
    it("returns 403 for an anonymous (non-admin) user with is_pdf and does no work", async () => {
      const res = await POST(makeRequest({ ...VALID_BODY, is_pdf: true }));
      expect(res.status).toBe(403);
      expect((await res.json()).error).toMatch(/admin/i);
      expect(checkRateLimit).not.toHaveBeenCalled();
      expect(fetchAndPreprocessImage).not.toHaveBeenCalled();
      expect(processFlyer).not.toHaveBeenCalled();
    });

    it("returns 403 when a non-admin upload turns out to be a PDF by content-type", async () => {
      vi.mocked(fetchAndPreprocessImage).mockResolvedValue({
        imageBase64: "x",
        mediaType: "application/pdf",
        imageBuffer: null,
        isPdf: true,
        pdfBuf: new ArrayBuffer(8),
      } as never);
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(403);
      expect(processFlyer).not.toHaveBeenCalled();
    });

    it("still processes a plain image for a non-admin user", async () => {
      const res = await POST(makeRequest(VALID_BODY));
      expect(res.status).toBe(200);
    });
  });
});
