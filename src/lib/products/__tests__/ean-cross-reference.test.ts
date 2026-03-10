import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClientIfConfigured: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { warn: vi.fn() },
}));

import { findEanCrossReferences } from "../ean-cross-reference";
import { createClientIfConfigured } from "@/lib/supabase/client";

const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockIn = vi.fn();
const mockEq = vi.fn();
const mockNeq = vi.fn();
const mockLimit = vi.fn();

function buildChain() {
  return {
    select: mockSelect.mockReturnThis(),
    in: mockIn.mockReturnThis(),
    eq: mockEq.mockReturnThis(),
    neq: mockNeq.mockReturnThis(),
    limit: mockLimit,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("findEanCrossReferences", () => {
  test("returns empty result when EAN is empty", async () => {
    const result = await findEanCrossReferences("", "any-id");
    expect(result).toEqual({ aldiProduct: null, competitorProducts: [] });
  });

  test("returns empty result when Supabase is not configured", async () => {
    vi.mocked(createClientIfConfigured).mockReturnValue(null);
    const result = await findEanCrossReferences("4000417025005", "any-id");
    expect(result).toEqual({ aldiProduct: null, competitorProducts: [] });
  });

  test("returns cross references when both tables have matches", async () => {
    const aldiRow = {
      product_id: "aldi-1",
      name: "Milka",
      price: 1.29,
      thumbnail_url: "https://example.com/front.jpg",
      brand: "Milka",
      ean_barcode: "4000417025005",
    };
    const competitorRow = {
      product_id: "comp-1",
      name: "Milka Alpine",
      brand: "Milka",
      ean_barcode: "4000417025005",
      thumbnail_url: "https://example.com/comp.jpg",
      retailer: "EDEKA",
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      const chain = buildChain();
      if (callCount === 1) {
        chain.limit.mockResolvedValue({ data: [aldiRow] });
      } else {
        chain.limit.mockResolvedValue({ data: [competitorRow] });
      }
      return chain;
    });

    vi.mocked(createClientIfConfigured).mockReturnValue({ from: mockFrom } as never);

    const result = await findEanCrossReferences("4000417025005", "other-id");

    expect(result.aldiProduct).toBeTruthy();
    expect(result.aldiProduct!.name).toBe("Milka");
    expect(result.competitorProducts).toHaveLength(1);
    expect(result.competitorProducts[0].retailer).toBe("EDEKA");
  });

  test("returns empty when no matches found", async () => {
    mockFrom.mockImplementation(() => {
      const chain = buildChain();
      chain.limit.mockResolvedValue({ data: [] });
      return chain;
    });

    vi.mocked(createClientIfConfigured).mockReturnValue({ from: mockFrom } as never);

    const result = await findEanCrossReferences("0000000000000", "any-id");
    expect(result.aldiProduct).toBeNull();
    expect(result.competitorProducts).toHaveLength(0);
  });
});
