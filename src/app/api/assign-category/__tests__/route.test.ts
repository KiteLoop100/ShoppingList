import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/guards";
import {
  checkRateLimit,
  getGlobalAiCapLimiter,
  isRateLimitConfigured,
} from "@/lib/api/rate-limit";

vi.mock("@/lib/api/rate-limit", () => ({
  claudeRateLimit: { fake: "claude" },
  checkRateLimit: vi.fn().mockResolvedValue(null),
  getIdentifier: vi.fn().mockReturnValue("test"),
  isRateLimitConfigured: vi.fn().mockReturnValue(true),
  getGlobalAiCapLimiter: vi.fn(),
}));

vi.mock("@/lib/api/guards", () => ({
  requireApiKey: vi.fn().mockReturnValue("mock-key"),
  requireSupabaseAdmin: vi.fn().mockReturnValue(mockSupabase()),
  requireAuth: vi.fn(),
}));

vi.mock("@/lib/api/claude-client", () => ({
  callClaudeJSON: vi.fn(),
}));

vi.mock("@/lib/categories/constants", () => ({
  loadDemandGroups: vi.fn().mockResolvedValue([
    { code: "83", name: "Milch/Sahne/Butter", name_en: "Dairy" },
    { code: "38", name: "Gemüse", name_en: "Vegetables" },
  ]),
  loadDemandSubGroups: vi.fn().mockResolvedValue([
    { code: "83-01", name: "Milchgetränke", name_en: "Milk Drinks", demand_group_code: "83" },
    { code: "83-02", name: "Milch", name_en: "Milk", demand_group_code: "83" },
    { code: "38-01", name: "Frischgemüse", name_en: "Fresh Veg", demand_group_code: "38" },
  ]),
  buildDemandGroupsAndSubGroupsPrompt: vi.fn().mockReturnValue("prompt text"),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/api/config", () => ({
  CLAUDE_MODEL_HAIKU: "claude-haiku-test",
}));

function mockSupabase() {
  const fromFn = vi.fn();
  return {
    from: fromFn,
    _fromFn: fromFn,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/assign-category", {
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

describe("/api/assign-category", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireAuth).mockResolvedValue({ user: { id: "user-1" } } as never);
    vi.mocked(checkRateLimit).mockResolvedValue(null);
    vi.mocked(isRateLimitConfigured).mockReturnValue(true);
    setCap(true);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("access control and limits", () => {
    test("returns 401 when there is no session and calls no AI", async () => {
      vi.mocked(requireAuth).mockResolvedValue(
        NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
      );
      const { callClaudeJSON } = await import("@/lib/api/claude-client");
      const { POST } = await import("../route");
      const res = await POST(makeRequest({ productName: "Milch" }));
      expect(res.status).toBe(401);
      expect(callClaudeJSON).not.toHaveBeenCalled();
    });

    test("returns 503 in production when Upstash is not configured", async () => {
      vi.stubEnv("NODE_ENV", "production");
      vi.mocked(isRateLimitConfigured).mockReturnValue(false);
      const { callClaudeJSON } = await import("@/lib/api/claude-client");
      const { POST } = await import("../route");
      const res = await POST(makeRequest({ productName: "Milch" }));
      expect(res.status).toBe(503);
      expect(callClaudeJSON).not.toHaveBeenCalled();
    });

    test("returns 429 when the per-user/IP limit is hit", async () => {
      vi.mocked(checkRateLimit).mockResolvedValue(
        NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 }),
      );
      const { callClaudeJSON } = await import("@/lib/api/claude-client");
      const { POST } = await import("../route");
      const res = await POST(makeRequest({ productName: "Milch" }));
      expect(res.status).toBe(429);
      expect(callClaudeJSON).not.toHaveBeenCalled();
    });

    test("returns 429 global_daily_cap when the global cap is hit", async () => {
      setCap(false);
      const { callClaudeJSON } = await import("@/lib/api/claude-client");
      const { POST } = await import("../route");
      const res = await POST(makeRequest({ productName: "Milch" }));
      expect(res.status).toBe(429);
      expect((await res.json()).code).toBe("global_daily_cap");
      expect(callClaudeJSON).not.toHaveBeenCalled();
    });

    test("applies user and IP limits with the claude limiter", async () => {
      const { callClaudeJSON } = await import("@/lib/api/claude-client");
      (callClaudeJSON as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
        demand_group_code: "83",
        demand_sub_group: "83-02",
        confidence: "high",
      });
      const { POST } = await import("../route");
      await POST(makeRequest({ productName: "Vollmilch" }));
      expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "user:user-1");
      expect(checkRateLimit).toHaveBeenCalledWith({ fake: "claude" }, "ip:test");
    });

    test("invalid input does not consume rate-limit quota", async () => {
      const { POST } = await import("../route");
      const res = await POST(makeRequest({ productName: "" }));
      expect(res.status).toBe(400);
      expect(checkRateLimit).not.toHaveBeenCalled();
    });
  });

  test("Stage 1: matches existing group and sub-group", async () => {
    const { callClaudeJSON } = await import("@/lib/api/claude-client");
    (callClaudeJSON as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      demand_group_code: "83",
      demand_sub_group: "83-02",
      confidence: "high",
    });

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ productName: "Vollmilch 3.5%" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.demand_group_code).toBe("83");
    expect(json.demand_group_name).toBe("Milch/Sahne/Butter");
    expect(json.demand_sub_group).toBe("83-02");
    expect(json.action).toBe("matched");
  });

  test("Stage 2: creates new group when no match found", async () => {
    const { callClaudeJSON } = await import("@/lib/api/claude-client");
    const { requireSupabaseAdmin } = await import("@/lib/api/guards");

    // Stage 1 returns no match
    (callClaudeJSON as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      demand_group_code: null,
      confidence: "none",
    });
    // Stage 2 returns new group proposal
    (callClaudeJSON as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      action: "create_new",
      demand_group: {
        code: "AUTO",
        name: "Tierfutter",
        name_en: "Pet Food",
        suggested_parent_meta: "M08",
      },
      demand_sub_group: {
        code: "AUTO",
        name: "Hundefutter",
        name_en: "Dog Food",
      },
    });

    const sb = (requireSupabaseAdmin as ReturnType<typeof vi.fn>)();
    // generateNextAgCode: no existing AG codes
    sb.from.mockImplementation((table: string) => {
      if (table === "demand_groups") {
        return {
          select: vi.fn().mockReturnValue({
            like: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: {}, error: null }),
            }),
          }),
          update: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        };
      }
      if (table === "demand_sub_groups") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [] }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: {}, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });

    // Re-mock guards to return our prepared supabase
    (requireSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(sb);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ productName: "Hundefutter Premium" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.demand_group_code).toBe("AG01");
    expect(json.demand_group_name).toBe("Tierfutter");
    expect(json.demand_sub_group).toBe("AG01-01");
    expect(json.action).toBe("created");
  });

  test("AG code increments from existing AG codes", async () => {
    const { generateNextAgCode } = await import("@/lib/categories/generate-ag-code");
    const sb = mockSupabase();
    sb._fromFn.mockReturnValue({
      select: vi.fn().mockReturnValue({
        like: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [{ code: "AG05" }] }),
          }),
        }),
      }),
    });

    const code = await generateNextAgCode(sb as unknown as import("@supabase/supabase-js").SupabaseClient);
    expect(code).toBe("AG06");
  });

  test("AG code starts at AG01 with no existing codes", async () => {
    const { generateNextAgCode } = await import("@/lib/categories/generate-ag-code");
    const sb = mockSupabase();
    sb._fromFn.mockReturnValue({
      select: vi.fn().mockReturnValue({
        like: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({ data: [] }),
          }),
        }),
      }),
    });

    const code = await generateNextAgCode(sb as unknown as import("@supabase/supabase-js").SupabaseClient);
    expect(code).toBe("AG01");
  });

  test("returns 400 for empty productName", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({ productName: "" }));
    expect(res.status).toBe(400);
  });

  test("returns 400 for missing productName", async () => {
    const { POST } = await import("../route");
    const res = await POST(makeRequest({}));
    expect(res.status).toBe(400);
  });

  test("ON CONFLICT: no error when group already exists", async () => {
    const { callClaudeJSON } = await import("@/lib/api/claude-client");
    const { requireSupabaseAdmin } = await import("@/lib/api/guards");

    (callClaudeJSON as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      demand_group_code: null,
      confidence: "none",
    });
    (callClaudeJSON as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      action: "create_new",
      demand_group: { code: "AUTO", name: "Test", name_en: "Test", suggested_parent_meta: "M01" },
      demand_sub_group: { code: "AUTO", name: "Sub Test", name_en: "Sub Test" },
    });

    const sb = (requireSupabaseAdmin as ReturnType<typeof vi.fn>)();
    sb.from.mockImplementation((table: string) => {
      if (table === "demand_groups") {
        return {
          select: vi.fn().mockReturnValue({
            like: vi.fn().mockReturnValue({
              order: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue({ data: [] }),
              }),
            }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: "duplicate key value violates unique constraint" },
              }),
            }),
          }),
        };
      }
      if (table === "demand_sub_groups") {
        return {
          select: vi.fn().mockReturnValue({
            order: vi.fn().mockResolvedValue({ data: [] }),
          }),
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: {}, error: null }),
            }),
          }),
        };
      }
      return { select: vi.fn() };
    });
    (requireSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(sb);

    const { POST } = await import("../route");
    const res = await POST(makeRequest({ productName: "Duplicate Test Product" }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.demand_group_code).toBe("AG01");
  });
});
