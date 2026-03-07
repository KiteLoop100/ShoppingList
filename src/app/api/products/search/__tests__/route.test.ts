import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/api/rate-limit", () => ({
  generalRateLimit: { fake: true },
  checkRateLimit: vi.fn(),
  getIdentifier: vi.fn(() => "test-ip"),
}));

vi.mock("@/lib/api/guards", () => ({
  requireSupabaseAdmin: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), error: vi.fn(), warn: vi.fn() },
}));

import { GET } from "../route";
import { requireSupabaseAdmin } from "@/lib/api/guards";
import { checkRateLimit } from "@/lib/api/rate-limit";

function makeRequest(params: Record<string, string> = {}): Request {
  const url = new URL("http://localhost/api/products/search");
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Request(url.toString(), { method: "GET" });
}

function fakeSupabase(rows: unknown[] = []) {
  const or = vi.fn().mockReturnThis();
  const limit = vi.fn().mockReturnThis();
  const eq = vi.fn().mockReturnThis();
  const select = vi.fn(() => ({ eq, limit, or }));
  const from = vi.fn(() => ({ select }));

  or.mockResolvedValue({ data: rows, error: null });

  return { from, select, eq, limit, or };
}

describe("GET /api/products/search", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(checkRateLimit).mockResolvedValue(null);

    const sb = fakeSupabase();
    vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);
  });

  it("returns 400 when query parameter q is missing", async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
    expect(body.details).toHaveProperty("q");
  });

  it("returns 400 when query parameter q is empty", async () => {
    const res = await GET(makeRequest({ q: "" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Validation failed");
  });

  it("returns 200 with products array for valid query", async () => {
    const product = {
      product_id: "p-1",
      name: "Milch",
      name_normalized: "milch",
      demand_group_code: "DG01",
      price: 1.29,
      status: "active",
      country: "DE",
      demand_groups: { name: "Molkereiprodukte" },
    };
    const sb = fakeSupabase([product]);
    vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);

    const res = await GET(makeRequest({ q: "Milch" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.products)).toBe(true);
    expect(body.products[0]).toMatchObject({
      product_id: "p-1",
      name: "Milch",
      demand_group_name: "Molkereiprodukte",
    });
  });

  it("returns 429 when rate limit is exceeded", async () => {
    vi.mocked(checkRateLimit).mockResolvedValue(
      NextResponse.json(
        { error: "Rate limit exceeded. Try again later." },
        { status: 429 },
      ),
    );

    const res = await GET(makeRequest({ q: "Milch" }));
    expect(res.status).toBe(429);
  });

  it("uses default country DE and limit 20 when not specified", async () => {
    const sb = fakeSupabase([]);
    vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);

    await GET(makeRequest({ q: "Milch" }));

    expect(sb.eq).toHaveBeenCalledWith("country", "DE");
    expect(sb.limit).toHaveBeenCalledWith(60); // limit * 3 = 20 * 3
  });

  it("includes thumbnail_url in response when product has one", async () => {
    const product = {
      product_id: "p-2",
      name: "Butter",
      name_normalized: "butter",
      demand_group_code: "DG02",
      price: 1.99,
      thumbnail_url: "https://example.supabase.co/storage/v1/object/public/product-thumbnails/p2.webp",
      status: "active",
      country: "DE",
      demand_groups: { name: "Molkereiprodukte" },
    };
    const sb = fakeSupabase([product]);
    vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);

    const res = await GET(makeRequest({ q: "Butter" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products[0].thumbnail_url).toBe(
      "https://example.supabase.co/storage/v1/object/public/product-thumbnails/p2.webp",
    );
  });

  it("returns thumbnail_url as null when product has no thumbnail", async () => {
    const product = {
      product_id: "p-3",
      name: "Brot",
      name_normalized: "brot",
      demand_group_code: "DG03",
      price: 0.99,
      status: "active",
      country: "DE",
      demand_groups: { name: "Brot" },
    };
    const sb = fakeSupabase([product]);
    vi.mocked(requireSupabaseAdmin).mockReturnValue(sb as never);

    const res = await GET(makeRequest({ q: "Brot" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.products[0].thumbnail_url).toBeNull();
  });
});
