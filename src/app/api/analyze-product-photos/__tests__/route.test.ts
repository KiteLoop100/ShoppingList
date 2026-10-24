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
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/product-photo-studio/pipeline", () => ({
  processProductPhotos: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { POST, maxDuration } from "../route";
import { requireApiKey, requireAuth } from "@/lib/api/guards";
import {
  checkRateLimit,
  getGlobalAiCapLimiter,
  isRateLimitConfigured,
} from "@/lib/api/rate-limit";
import { processProductPhotos } from "@/lib/product-photo-studio/pipeline";

const IMAGE = { image_base64: "A".repeat(200), media_type: "image/jpeg" };

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/analyze-product-photos", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function setCap(success: boolean) {
  // Route guards only peek at the global cap (the real count happens in callClaude).
  const limit = vi.fn().mockResolvedValue({ remaining: success ? 5 : 0, limit: 200, reset: Date.now() + 60_000 });
  vi.mocked(getGlobalAiCapLimiter).mockReturnValue({ getRemaining: limit } as never);
}

describe("POST /api/analyze-product-photos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireApiKey).mockReturnValue("sk-test");
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    setCap(true);
    vi.mocked(processProductPhotos).mockResolvedValue({
      status: "ok",
      extractedData: { name: "Milch" },
      backgroundRemoved: false,
      processingTimeMs: 12,
    } as never);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("keeps maxDuration 120", () => {
    expect(maxDuration).toBe(120);
  });

  it("returns 401 when there is no session and does no work", async () => {
    vi.mocked(requireAuth).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await POST(makeRequest({ images: [IMAGE] }));
    expect(res.status).toBe(401);
    expect(processProductPhotos).not.toHaveBeenCalled();
  });

  it("returns 503 in production when Upstash is not configured", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.mocked(isRateLimitConfigured).mockReturnValue(false);
    const res = await POST(makeRequest({ images: [IMAGE] }));
    expect(res.status).toBe(503);
    expect(processProductPhotos).not.toHaveBeenCalled();
  });

  it("returns 400 for invalid JSON", async () => {
    const req = new Request("http://localhost/api/analyze-product-photos", {
      method: "POST",
      body: "nope",
    });
    expect((await POST(req)).status).toBe(400);
  });

  it("returns 400 for invalid input and does not consume quota", async () => {
    const res = await POST(makeRequest({ images: [] }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("Invalid input");
    expect(checkRateLimit).not.toHaveBeenCalled();
    expect(processProductPhotos).not.toHaveBeenCalled();
  });

  it("returns 400 when photo_roles length does not match images", async () => {
    const res = await POST(makeRequest({ images: [IMAGE], photo_roles: ["front", "extra"] }));
    expect(res.status).toBe(400);
    expect(processProductPhotos).not.toHaveBeenCalled();
  });

  it("returns 429 when the per-user/IP limit is hit", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(
      NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }),
    );
    const res = await POST(makeRequest({ images: [IMAGE] }));
    expect(res.status).toBe(429);
    expect(processProductPhotos).not.toHaveBeenCalled();
  });

  it("returns 429 global_daily_cap when the global cap is hit", async () => {
    setCap(false);
    const res = await POST(makeRequest({ images: [IMAGE] }));
    expect(res.status).toBe(429);
    expect((await res.json()).code).toBe("global_daily_cap");
    expect(processProductPhotos).not.toHaveBeenCalled();
  });

  it("analyzes photos and applies user + IP limits (happy path)", async () => {
    const res = await POST(makeRequest({ images: [IMAGE], photo_roles: ["front"] }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json).toMatchObject({ ok: true, status: "ok", extracted_data: { name: "Milch" } });
    expect(processProductPhotos).toHaveBeenCalledTimes(1);
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "user:user-1");
    expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "ip:test-ip");
  });

  it("returns 502 when the pipeline throws", async () => {
    vi.mocked(processProductPhotos).mockRejectedValue(new Error("boom"));
    const res = await POST(makeRequest({ images: [IMAGE] }));
    expect(res.status).toBe(502);
  });
});
