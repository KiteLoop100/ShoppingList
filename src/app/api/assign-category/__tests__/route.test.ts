import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  claudeRateLimit: {},
  checkRateLimit: vi.fn().mockResolvedValue(null),
  getIdentifier: vi.fn().mockReturnValue("test"),
}));

vi.mock("@/lib/api/guards", () => ({
  requireApiKey: vi.fn().mockReturnValue("mock-key"),
  requireSupabaseAdmin: vi.fn().mockReturnValue(mockSupabase()),
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

describe("/api/assign-category", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const { generateNextAgCode } = await import("../route");
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
    const { generateNextAgCode } = await import("../route");
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
