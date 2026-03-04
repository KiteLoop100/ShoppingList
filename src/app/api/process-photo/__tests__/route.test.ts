import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  claudeRateLimit: { fake: true },
  checkRateLimit: vi.fn(),
  getIdentifier: vi.fn(() => "test-ip"),
}));

vi.mock("@/lib/api/guards", () => ({
  requireApiKey: vi.fn(),
  requireSupabaseAdmin: vi.fn(),
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
  processVisionPhoto: vi.fn(
    () => NextResponse.json({ ok: true }),
  ),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { POST } from "../route";
import { requireApiKey, requireSupabaseAdmin } from "@/lib/api/guards";
import { checkRateLimit } from "@/lib/api/rate-limit";
import { fetchAndPreprocessImage } from "@/lib/api/photo-processing/image-utils";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/process-photo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function fakeSupabase() {
  const update = vi.fn().mockReturnThis();
  const eq = vi.fn().mockReturnThis();
  const lt = vi.fn().mockResolvedValue({ error: null });
  const from = vi.fn(() => ({ update, eq, lt, select: vi.fn().mockReturnThis() }));
  return { from, update, eq, lt };
}

describe("POST /api/process-photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiKey).mockReturnValue("sk-test");
    vi.mocked(checkRateLimit).mockResolvedValue(null);

    const sb = fakeSupabase();
    vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);

    vi.mocked(fetchAndPreprocessImage).mockResolvedValue({
      imageBase64: "base64data",
      mediaType: "image/jpeg",
      imageBuffer: Buffer.from("test"),
      isPdf: false,
    } as never);
  });

  it("returns 400 when upload_id is missing", async () => {
    const res = await POST(makeRequest({ photo_url: "https://example.com/photo.jpg" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid input");
  });

  it("returns 400 when upload_id is empty string", async () => {
    const res = await POST(
      makeRequest({ upload_id: "", photo_url: "https://example.com/photo.jpg" }),
    );
    expect(res.status).toBe(400);
  });

  it("returns 400 when photo_url is not a valid URL", async () => {
    const res = await POST(
      makeRequest({ upload_id: "abc-123", photo_url: "not-a-url" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid input");
  });

  it("returns 400 when body is invalid JSON", async () => {
    const req = new Request("http://localhost/api/process-photo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json at all",
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid JSON");
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(
      NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 },
      ),
    );

    const res = await POST(
      makeRequest({ upload_id: "abc-123", photo_url: "https://example.com/photo.jpg" }),
    );
    expect(res.status).toBe(429);
  });

  it("returns 500 when API key is not configured", async () => {
    vi.mocked(requireApiKey).mockReturnValue(
      NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 }),
    );

    const res = await POST(
      makeRequest({ upload_id: "abc-123", photo_url: "https://example.com/photo.jpg" }),
    );
    expect(res.status).toBe(500);
  });

  it("accepts valid input and processes the photo", async () => {
    const res = await POST(
      makeRequest({ upload_id: "abc-123", photo_url: "https://example.com/photo.jpg" }),
    );
    expect(res.status).toBe(200);
    expect(fetchAndPreprocessImage).toHaveBeenCalledWith(
      "https://example.com/photo.jpg",
      undefined,
    );
  });
});
