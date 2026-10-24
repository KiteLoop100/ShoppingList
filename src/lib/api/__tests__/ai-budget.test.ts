import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/api/rate-limit", () => ({
  isRateLimitConfigured: vi.fn(() => true),
  getGlobalAiCapLimiter: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import {
  AiBudgetError,
  consumeGlobalAiCall,
  isBudgetUnavailable,
  peekGlobalAiCap,
} from "../ai-budget";
import { getGlobalAiCapLimiter, isRateLimitConfigured } from "@/lib/api/rate-limit";

function limiter(overrides: Record<string, unknown> = {}) {
  const impl = {
    limit: vi.fn().mockResolvedValue({ success: true, reset: Date.now() + 1000 }),
    getRemaining: vi.fn().mockResolvedValue({ remaining: 10, limit: 200, reset: Date.now() + 1000 }),
    ...overrides,
  };
  vi.mocked(getGlobalAiCapLimiter).mockReturnValue(impl as never);
  return impl;
}

describe("ai-budget", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("consumeGlobalAiCall", () => {
    it("counts one call on the shared 'global' identifier", async () => {
      const l = limiter();
      await consumeGlobalAiCall();
      expect(l.limit).toHaveBeenCalledTimes(1);
      expect(l.limit).toHaveBeenCalledWith("global");
    });

    it("throws global_daily_cap (429) with reset time when the cap is reached", async () => {
      const reset = Date.now() + 5000;
      limiter({ limit: vi.fn().mockResolvedValue({ success: false, reset }) });
      await expect(consumeGlobalAiCall()).rejects.toMatchObject({
        name: "AiBudgetError",
        code: "global_daily_cap",
        status: 429,
        reset,
      });
    });

    it("fails closed (503) when Redis errors", async () => {
      limiter({ limit: vi.fn().mockRejectedValue(new Error("redis down")) });
      await expect(consumeGlobalAiCall()).rejects.toMatchObject({
        code: "ai_unavailable",
        status: 503,
      });
    });

    it("refuses with 503 in production when Upstash is not configured", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.mocked(isRateLimitConfigured).mockReturnValue(false);
      vi.mocked(getGlobalAiCapLimiter).mockReturnValue(null);
      await expect(consumeGlobalAiCall()).rejects.toMatchObject({ status: 503 });
    });

    it("is a no-op outside production when Upstash is not configured", async () => {
      vi.stubEnv("NODE_ENV", "development");
      vi.mocked(isRateLimitConfigured).mockReturnValue(false);
      vi.mocked(getGlobalAiCapLimiter).mockReturnValue(null);
      await expect(consumeGlobalAiCall()).resolves.toBeUndefined();
    });
  });

  describe("peekGlobalAiCap", () => {
    it("returns null while budget remains and never consumes", async () => {
      const l = limiter();
      expect(await peekGlobalAiCap()).toBeNull();
      expect(l.limit).not.toHaveBeenCalled();
    });

    it("returns the reset time when nothing remains", async () => {
      const reset = Date.now() + 9000;
      limiter({ getRemaining: vi.fn().mockResolvedValue({ remaining: 0, limit: 200, reset }) });
      expect(await peekGlobalAiCap()).toEqual({ reset });
    });

    it("returns null without a limiter (dev)", async () => {
      vi.mocked(getGlobalAiCapLimiter).mockReturnValue(null);
      expect(await peekGlobalAiCap()).toBeNull();
    });

    it("throws AiBudgetError 503 when Redis errors", async () => {
      limiter({ getRemaining: vi.fn().mockRejectedValue(new Error("down")) });
      await expect(peekGlobalAiCap()).rejects.toBeInstanceOf(AiBudgetError);
    });
  });

  describe("isBudgetUnavailable", () => {
    it("is true only in production without Upstash", () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.mocked(isRateLimitConfigured).mockReturnValue(false);
      expect(isBudgetUnavailable()).toBe(true);
      vi.mocked(isRateLimitConfigured).mockReturnValue(true);
      expect(isBudgetUnavailable()).toBe(false);
    });
  });
});
