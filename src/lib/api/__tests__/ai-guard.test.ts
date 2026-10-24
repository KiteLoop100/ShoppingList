import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  checkRateLimit: vi.fn(),
  getIdentifier: vi.fn(() => "1.2.3.4"),
  isRateLimitConfigured: vi.fn(() => true),
  getGlobalAiCapLimiter: vi.fn(),
}));

vi.mock("@/lib/api/guards", () => ({
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { requireAiUser, enforceAiLimits, rateLimiterUnavailableResponse } from "../ai-guard";
import { requireAuth } from "@/lib/api/guards";
import {
  checkRateLimit,
  getGlobalAiCapLimiter,
  isRateLimitConfigured,
} from "@/lib/api/rate-limit";

const limiter = { fake: true } as never;
const req = new Request("http://localhost/api/x", { method: "POST" });

function tooMany(): NextResponse {
  return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 });
}

function capLimiter(success: boolean, reset = Date.now() + 3_600_000) {
  const limit = vi.fn().mockResolvedValue({ success, reset });
  vi.mocked(getGlobalAiCapLimiter).mockReturnValue({ limit } as never);
  return limit;
}

describe("ai-guard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "u1" } } as never);
    capLimiter(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("rateLimiterUnavailableResponse / requireAiUser", () => {
    it("returns 503 in production when Upstash is not configured", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.mocked(isRateLimitConfigured).mockReturnValue(false);

      expect(rateLimiterUnavailableResponse()?.status).toBe(503);
      const res = await requireAiUser(req);
      expect(res).toBeInstanceOf(NextResponse);
      expect((res as NextResponse).status).toBe(503);
      expect(requireAuth).not.toHaveBeenCalled();
    });

    it("does not block outside production when Upstash is missing (local dev)", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.mocked(isRateLimitConfigured).mockReturnValue(false);

      expect(rateLimiterUnavailableResponse()).toBeNull();
      const res = await requireAiUser(req);
      expect(res).toEqual({ user: { id: "u1" } });
    });

    it("passes through the 401 from requireAuth", async () => {
      vi.mocked(requireAuth).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const res = await requireAiUser(req);
      expect((res as NextResponse).status).toBe(401);
    });

    it("returns the user when authenticated and Upstash is configured", async () => {
      vi.stubEnv("NODE_ENV", "production");
      const res = await requireAiUser(req);
      expect(res).toEqual({ user: { id: "u1" } });
    });
  });

  describe("enforceAiLimits", () => {
    it("returns null when user, IP and global cap all pass", async () => {
      expect(await enforceAiLimits(req, "u1", limiter)).toBeNull();
    });

    it("checks user.id and IP with distinct prefixed identifiers", async () => {
      await enforceAiLimits(req, "u1", limiter);
      expect(checkRateLimit).toHaveBeenNthCalledWith(1, limiter, "user:u1");
      expect(checkRateLimit).toHaveBeenNthCalledWith(2, limiter, "ip:1.2.3.4");
    });

    it("returns 429 when the per-user limit is hit and skips later layers", async () => {
      vi.mocked(checkRateLimit).mockResolvedValueOnce(tooMany());
      const limit = capLimiter(true);

      const res = await enforceAiLimits(req, "u1", limiter);
      expect(res?.status).toBe(429);
      expect(checkRateLimit).toHaveBeenCalledTimes(1);
      expect(limit).not.toHaveBeenCalled();
    });

    it("returns 429 when only the per-IP limit is hit (fresh anonymous user, same IP)", async () => {
      vi.mocked(checkRateLimit)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(tooMany());
      const limit = capLimiter(true);

      const res = await enforceAiLimits(req, "brand-new-anon", limiter);
      expect(res?.status).toBe(429);
      expect(limit).not.toHaveBeenCalled();
    });

    it("returns 429 with code global_daily_cap and Retry-After when the global cap is hit", async () => {
      const limit = capLimiter(false, Date.now() + 90_000);

      const res = await enforceAiLimits(req, "u1", limiter);
      expect(res?.status).toBe(429);
      expect(limit).toHaveBeenCalledWith("global");
      const body = await res!.json();
      expect(body.code).toBe("global_daily_cap");
      const retryAfter = Number(res!.headers.get("Retry-After"));
      expect(retryAfter).toBeGreaterThan(0);
      expect(retryAfter).toBeLessThanOrEqual(90);
    });

    it("skips the global cap when no cap limiter exists (Upstash off in dev)", async () => {
      vi.mocked(getGlobalAiCapLimiter).mockReturnValue(null);
      expect(await enforceAiLimits(req, "u1", null)).toBeNull();
    });

    it("fails closed with 503 when a limiter throws", async () => {
      vi.mocked(checkRateLimit).mockRejectedValue(new Error("redis down"));
      const res = await enforceAiLimits(req, "u1", limiter);
      expect(res?.status).toBe(503);
    });

    it("fails closed with 503 when the global cap limiter throws", async () => {
      vi.mocked(getGlobalAiCapLimiter).mockReturnValue({
        limit: vi.fn().mockRejectedValue(new Error("redis down")),
      } as never);
      const res = await enforceAiLimits(req, "u1", limiter);
      expect(res?.status).toBe(503);
    });
  });
});
