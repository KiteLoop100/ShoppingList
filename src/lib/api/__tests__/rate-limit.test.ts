/**
 * Exercises the REAL @upstash/ratelimit `Ratelimit` class against an
 * in-memory fake of `@upstash/redis` that emulates the handful of Lua scripts
 * the fixed-window and sliding-window limiters run. Only `@upstash/redis` is
 * mocked; `rate-limit.ts` itself is the system under test.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Minimal Redis emulation for the scripts in @upstash/ratelimit:
 *  - fixedWindow limit: INCRBY key, PEXPIRE on first hit → [used, limit]
 *  - fixedWindow getRemaining: GET key → [limit - used, limit]
 *  - slidingWindow limit / getRemaining: current + weighted previous bucket
 * Scripts are told apart by distinctive substrings of their Lua source.
 */
class FakeRedis {
  store = new Map<string, number>();

  async evalsha(): Promise<never> {
    throw new Error("NOSCRIPT No matching script");
  }

  async eval(script: string, keys: string[], args: unknown[]): Promise<unknown> {
    const isSliding = script.includes("previousKey");
    const isLimit = script.includes("INCRBY");
    const tokens = Number(args[0]);

    if (!isSliding && isLimit) {
      const incrementBy = Number(args[2] ?? 1);
      const used = (this.store.get(keys[0]) ?? 0) + incrementBy;
      this.store.set(keys[0], used);
      return [used, tokens];
    }
    if (!isSliding && !isLimit) {
      const used = this.store.get(keys[0]) ?? 0;
      return [tokens - used, tokens];
    }

    const now = Number(args[1]);
    const window = Number(args[2]);
    const current = this.store.get(keys[0]) ?? 0;
    const previousRaw = this.store.get(keys[1]) ?? 0;
    const pct = (now % window) / window;
    const previous = Math.floor((1 - pct) * previousRaw);

    if (isLimit) {
      const incrementBy = Number(args[3] ?? 1);
      if (incrementBy > 0 && previous + current >= tokens) return [-1, tokens];
      const next = current + incrementBy;
      this.store.set(keys[0], next);
      return [tokens - (next + previous), tokens];
    }
    return [tokens - (previous + current), tokens];
  }

  /** Analytics ingestion (Ratelimit `analytics: true`). */
  async zincrby(): Promise<number> {
    return 1;
  }
}

/** Holder so the hoisted mock can hand out the fake created in beforeEach. */
const holder = vi.hoisted(() => ({ redis: null as unknown }));

// `new Redis(...)` in rate-limit.ts (module scope) returns the current fake.
vi.mock("@upstash/redis", () => ({
  Redis: class {
    constructor() {
      return holder.redis as object;
    }
  },
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

/** Fresh module instance per test so module-scope `redis` picks up env + fake. */
async function loadModule() {
  vi.resetModules();
  return import("../rate-limit");
}

describe("rate-limit (real Ratelimit, fake Redis)", () => {
  let redis: FakeRedis;

  beforeEach(() => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://fake.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "token");
    vi.stubEnv("AI_GLOBAL_DAILY_CAP", "");
    redis = new FakeRedis();
    holder.redis = redis;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("getGlobalAiDailyCap – env parsing", () => {
    it("defaults to 200 when unset", async () => {
      const m = await loadModule();
      expect(m.getGlobalAiDailyCap()).toBe(m.DEFAULT_GLOBAL_AI_DAILY_CAP);
      expect(m.DEFAULT_GLOBAL_AI_DAILY_CAP).toBe(200);
    });

    it.each([
      ["abc", 200],
      ["0", 200],
      ["-5", 200],
      ["12.5", 200],
      ["1e3", 1000], // Number("1e3") is the integer 1000
      ["350", 350],
    ])("AI_GLOBAL_DAILY_CAP=%s → %d", async (raw, expected) => {
      vi.stubEnv("AI_GLOBAL_DAILY_CAP", raw);
      const m = await loadModule();
      expect(m.getGlobalAiDailyCap()).toBe(expected);
    });
  });

  describe("getGlobalAiCapLimiter", () => {
    it("returns null without Upstash credentials", async () => {
      vi.stubEnv("UPSTASH_REDIS_REST_URL", "");
      vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "");
      const m = await loadModule();
      expect(m.isRateLimitConfigured()).toBe(false);
      expect(m.getGlobalAiCapLimiter()).toBeNull();
      expect(m.claudeRateLimit).toBeNull();
    });

    it("caches one limiter per cap value", async () => {
      const m = await loadModule();
      expect(m.getGlobalAiCapLimiter()).toBe(m.getGlobalAiCapLimiter());
      vi.stubEnv("AI_GLOBAL_DAILY_CAP", "5");
      const five = m.getGlobalAiCapLimiter();
      expect(five).not.toBe(null);
      vi.stubEnv("AI_GLOBAL_DAILY_CAP", "");
      expect(m.getGlobalAiCapLimiter()).not.toBe(five);
    });

    it("limit() → getRemaining() stay consistent and getRemaining reports 0 when exhausted", async () => {
      vi.stubEnv("AI_GLOBAL_DAILY_CAP", "3");
      const m = await loadModule();
      const limiter = m.getGlobalAiCapLimiter()!;

      expect((await limiter.getRemaining("global")).remaining).toBe(3);

      for (let i = 1; i <= 3; i++) {
        const r = await limiter.limit("global");
        expect(r.success).toBe(true);
        expect(r.remaining).toBe(3 - i);
        expect((await limiter.getRemaining("global")).remaining).toBe(3 - i);
      }

      // Exhausted: next limit() is refused and getRemaining stays at 0.
      const refused = await limiter.limit("global");
      expect(refused.success).toBe(false);
      expect(refused.remaining).toBe(0);
      const peek = await limiter.getRemaining("global");
      expect(peek.remaining).toBe(0);
      expect(peek.reset).toBeGreaterThan(Date.now());
    });

    it("counts the constant identifier in one shared bucket (not per user)", async () => {
      vi.stubEnv("AI_GLOBAL_DAILY_CAP", "2");
      const m = await loadModule();
      const limiter = m.getGlobalAiCapLimiter()!;
      await limiter.limit("global");
      await limiter.limit("global");
      expect((await limiter.limit("global")).success).toBe(false);
    });
  });

  describe("checkRateLimit (sliding window)", () => {
    it("returns null while under the limit and a 429 body once exceeded", async () => {
      const m = await loadModule();
      const { Ratelimit } = await import("@upstash/ratelimit");
      const limiter = new Ratelimit({
        redis: redis as never,
        limiter: Ratelimit.slidingWindow(2, "1 h"),
        prefix: "test",
      });

      expect(await m.checkRateLimit(limiter, "user:a")).toBeNull();
      expect(await m.checkRateLimit(limiter, "user:a")).toBeNull();

      const res = await m.checkRateLimit(limiter, "user:a");
      expect(res?.status).toBe(429);
      const body = await res!.json();
      expect(body).toMatchObject({ error: expect.stringContaining("Rate limit"), limit: 2, remaining: 0 });
      expect(body.reset).toBeGreaterThan(Date.now());

      // Different identifier → separate bucket.
      expect(await m.checkRateLimit(limiter, "user:b")).toBeNull();
    });

    it("allows everything when the limiter is null (Upstash not configured)", async () => {
      const m = await loadModule();
      expect(await m.checkRateLimit(null, "anyone")).toBeNull();
    });
  });

  describe("getIdentifier", () => {
    const req = (headers: Record<string, string>) =>
      new Request("http://localhost/api/x", { headers });

    it("prefers the explicit userId", async () => {
      const m = await loadModule();
      expect(m.getIdentifier(req({ "x-forwarded-for": "1.1.1.1" }), "user-1")).toBe("user-1");
    });

    it("takes the FIRST (client) address from a multi-hop x-forwarded-for", async () => {
      const m = await loadModule();
      expect(
        m.getIdentifier(req({ "x-forwarded-for": "203.0.113.7, 10.0.0.1 , 172.16.0.2" })),
      ).toBe("203.0.113.7");
    });

    it("falls back to x-real-ip, then to 'anonymous'", async () => {
      const m = await loadModule();
      expect(m.getIdentifier(req({ "x-real-ip": "198.51.100.4" }))).toBe("198.51.100.4");
      expect(m.getIdentifier(req({}))).toBe("anonymous");
    });

    it("treats an empty x-forwarded-for as missing", async () => {
      const m = await loadModule();
      expect(m.getIdentifier(req({ "x-forwarded-for": "" }))).toBe("anonymous");
    });
  });
});
