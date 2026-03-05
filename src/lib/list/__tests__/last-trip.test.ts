import { vi, describe, test, expect, beforeEach } from "vitest";

// ── Supabase mock ──────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: mockSelect,
    eq: mockEq,
    order: mockOrder,
    limit: mockLimit,
    maybeSingle: mockMaybeSingle,
  };
  for (const fn of Object.values(chain)) {
    fn.mockReturnValue(chain);
  }
  return chain;
}

const chain = chainable();

const mockSupabase = {
  from: vi.fn(() => chain),
};

vi.mock("@/lib/supabase/client", () => ({
  createClientIfConfigured: () => mockSupabase,
}));

vi.mock("@/lib/auth/auth-context", () => ({
  getCurrentUserId: () => "user-1",
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { getLastTrip } from "../last-trip";

const fakeTrip = {
  trip_id: "trip-1",
  completed_at: "2026-03-01T15:00:00Z",
};

const fakeTripItems = [
  {
    product_id: "prod-1",
    custom_name: null,
    display_name: "Milch",
    quantity: 2,
    demand_group_code: "01",
  },
  {
    product_id: null,
    custom_name: "Bio Eier",
    display_name: "Bio Eier",
    quantity: 1,
    demand_group_code: "02",
  },
];

describe("getLastTrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable();
  });

  test("returns last completed trip with items", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      const c = chainable();

      if (table === "shopping_trips") {
        c.maybeSingle.mockResolvedValue({ data: fakeTrip });
      } else if (table === "trip_items") {
        c.order.mockResolvedValue({ data: fakeTripItems });
      }

      return c;
    });

    const result = await getLastTrip();

    expect(result).not.toBeNull();
    expect(result!.trip_id).toBe("trip-1");
    expect(result!.item_count).toBe(2);
    expect(result!.items).toHaveLength(2);
    expect(result!.items[0].display_name).toBe("Milch");
    expect(result!.items[1].display_name).toBe("Bio Eier");
  });

  test("returns null when no trips exist", async () => {
    mockSupabase.from.mockImplementation(() => {
      const c = chainable();
      c.maybeSingle.mockResolvedValue({ data: null });
      return c;
    });

    const result = await getLastTrip();

    expect(result).toBeNull();
  });

  test("returns item_count 0 when trip has no items", async () => {
    mockSupabase.from.mockImplementation((table: string) => {
      const c = chainable();

      if (table === "shopping_trips") {
        c.maybeSingle.mockResolvedValue({ data: fakeTrip });
      } else if (table === "trip_items") {
        c.order.mockResolvedValue({ data: null });
      }

      return c;
    });

    const result = await getLastTrip();

    expect(result).not.toBeNull();
    expect(result!.item_count).toBe(0);
    expect(result!.items).toEqual([]);
  });

  test("defaults demand_group_code to 'AK' when null", async () => {
    const itemWithNullDGC = [
      {
        product_id: "prod-1",
        custom_name: null,
        display_name: "Kartoffeln",
        quantity: 1,
        demand_group_code: null,
      },
    ];

    mockSupabase.from.mockImplementation((table: string) => {
      const c = chainable();

      if (table === "shopping_trips") {
        c.maybeSingle.mockResolvedValue({ data: fakeTrip });
      } else if (table === "trip_items") {
        c.order.mockResolvedValue({ data: itemWithNullDGC });
      }

      return c;
    });

    const result = await getLastTrip();

    expect(result!.items[0].demand_group_code).toBe("AK");
  });
});
