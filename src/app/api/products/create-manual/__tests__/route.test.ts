import { describe, test, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  generalRateLimit: {},
  checkRateLimit: vi.fn().mockResolvedValue(null),
  getIdentifier: vi.fn().mockReturnValue("test-ip"),
}));

vi.mock("@/lib/api/guards", () => ({
  requireAuth: vi.fn().mockResolvedValue({ user: { id: "user-1" } }),
  requireSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/products/normalize", () => ({
  normalizeName: vi.fn((n: string) => n.toLowerCase()),
}));

vi.mock("@/lib/products/find-existing", () => ({
  findExistingProduct: vi.fn().mockResolvedValue(null),
}));

vi.mock("@/lib/products/upsert-product", () => ({
  upsertProduct: vi.fn(),
}));

vi.mock("@/lib/products/default-category", () => ({
  getDefaultDemandGroupCode: vi.fn().mockReturnValue("AK"),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("sharp", () => ({
  default: vi.fn(),
}));

vi.mock("@/lib/api/validate-url", () => ({
  validateExternalUrl: vi.fn(),
}));

function mockSupabase() {
  const updateEq = vi.fn().mockResolvedValue({ error: null });
  const updateFn = vi.fn().mockReturnValue({ eq: updateEq });
  const insertFn = vi.fn().mockResolvedValue({ error: null });
  const updateIn = vi.fn().mockResolvedValue({ error: null });

  return {
    from: vi.fn().mockReturnValue({
      update: updateFn,
      insert: insertFn,
    }),
    storage: {
      from: vi.fn().mockReturnValue({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://example.com/thumb.jpg" } }),
      }),
    },
    _updateFn: updateFn,
    _updateEq: updateEq,
  };
}

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/products/create-manual", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("/api/products/create-manual — demand_group_code", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("schema accepts demand_group_code and passes it through validation", async () => {
    const { createManualSchema } = await import("@/lib/api/schemas");

    const result = createManualSchema.safeParse({
      name: "Vollmilch",
      demand_group_code: "83",
      demand_sub_group: "83-01",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.demand_group_code).toBe("83");
      expect(result.data.demand_sub_group).toBe("83-01");
    }
  });

  test("schema allows demand_group_code to be null", async () => {
    const { createManualSchema } = await import("@/lib/api/schemas");

    const result = createManualSchema.safeParse({
      name: "Vollmilch",
      demand_group_code: null,
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.demand_group_code).toBeNull();
    }
  });

  test("UPDATE: demand_group_code is written to DB when updating existing product", async () => {
    const { requireSupabaseAdmin } = await import("@/lib/api/guards");
    const sb = mockSupabase();
    (requireSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(sb);

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        name: "Vollmilch 3.5%",
        demand_group_code: "83",
        demand_sub_group: "83-02",
        update_existing_product_id: "prod-123",
      }),
    );

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.updated).toBe(true);

    const updateCall = sb._updateFn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateCall.demand_group_code).toBe("83");
    expect(updateCall.demand_sub_group).toBe("83-02");
  });

  test("UPDATE: demand_sub_group is reset to null when demand_group_code changes without sub-group", async () => {
    const { requireSupabaseAdmin } = await import("@/lib/api/guards");
    const sb = mockSupabase();
    (requireSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(sb);

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        name: "Vollmilch 3.5%",
        demand_group_code: "38",
        update_existing_product_id: "prod-123",
      }),
    );

    const json = await res.json();
    expect(json.ok).toBe(true);

    const updateCall = sb._updateFn.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(updateCall.demand_group_code).toBe("38");
    expect(updateCall.demand_sub_group).toBeNull();
  });

  test("INSERT: uses client-sent demand_group_code instead of default", async () => {
    const { requireSupabaseAdmin } = await import("@/lib/api/guards");
    const { upsertProduct } = await import("@/lib/products/upsert-product");

    const sb = mockSupabase();
    (requireSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(sb);
    (upsertProduct as ReturnType<typeof vi.fn>).mockResolvedValue({
      product_id: "new-prod-1",
      created: true,
    });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        name: "Bio Karotten",
        demand_group_code: "38",
        demand_sub_group: "38-01",
      }),
    );

    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.product_id).toBe("new-prod-1");

    const upsertCall = (upsertProduct as ReturnType<typeof vi.fn>).mock.calls[0];
    const productData = upsertCall[1] as Record<string, unknown>;
    expect(productData.demand_group_code).toBe("38");
    expect(productData.demand_sub_group).toBe("38-01");
  });

  test("INSERT: falls back to default demand_group_code when client sends none", async () => {
    const { requireSupabaseAdmin } = await import("@/lib/api/guards");
    const { upsertProduct } = await import("@/lib/products/upsert-product");

    const sb = mockSupabase();
    (requireSupabaseAdmin as ReturnType<typeof vi.fn>).mockReturnValue(sb);
    (upsertProduct as ReturnType<typeof vi.fn>).mockResolvedValue({
      product_id: "new-prod-2",
      created: true,
    });

    const { POST } = await import("../route");
    const res = await POST(
      makeRequest({
        name: "Unbekanntes Produkt",
      }),
    );

    const json = await res.json();
    expect(json.ok).toBe(true);

    const upsertCall = (upsertProduct as ReturnType<typeof vi.fn>).mock.calls[0];
    const productData = upsertCall[1] as Record<string, unknown>;
    expect(productData.demand_group_code).toBe("AK");
  });
});
