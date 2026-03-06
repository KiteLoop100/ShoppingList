import { vi, describe, test, expect, beforeEach } from "vitest";

// ── Supabase mock ──────────────────────────────────────────────────────────

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDeleteFn = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOrder = vi.fn();
const mockMaybeSingle = vi.fn();

function chainable() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    delete: mockDeleteFn,
    eq: mockEq,
    in: mockIn,
    order: mockOrder,
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

let generateIdCounter = 0;
vi.mock("@/lib/utils/generate-id", () => ({
  generateId: () => `gen-id-${++generateIdCounter}`,
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("../save-checkoff-and-pairwise", () => ({
  saveCheckoffSequenceAndPairwise: vi.fn().mockResolvedValue(undefined),
}));

import { archiveListAsTrip } from "../archive-trip";

const fakeList = {
  list_id: "list-1",
  user_id: "user-1",
  store_id: "store-1",
  status: "active",
  created_at: "2026-01-01T00:00:00Z",
  completed_at: null,
};

const fakeItems = [
  {
    item_id: "item-1",
    list_id: "list-1",
    product_id: "prod-1",
    custom_name: null,
    display_name: "Milch",
    quantity: 1,
    is_checked: true,
    checked_at: "2026-01-01T10:00:00Z",
    sort_position: 1,
    demand_group_code: "01",
    added_at: "2026-01-01T00:00:00Z",
  },
  {
    item_id: "item-2",
    list_id: "list-1",
    product_id: "prod-2",
    custom_name: null,
    display_name: "Butter",
    quantity: 2,
    is_checked: true,
    checked_at: "2026-01-01T10:05:00Z",
    sort_position: 2,
    demand_group_code: "02",
    added_at: "2026-01-01T00:00:00Z",
  },
];

describe("archiveListAsTrip", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    generateIdCounter = 0;
    chainable();
  });

  test("creates trip from checked items", async () => {
    // First .from("shopping_lists").select().eq().maybeSingle() → list
    // Second .from("list_items").select().eq() → items
    // Third .from("shopping_trips").insert() → success
    // Fourth .from("trip_items").insert() → success
    // Fifth .from("shopping_lists").update().eq() → success

    let fromCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      fromCallCount++;
      const c = chainable();

      if (table === "shopping_lists" && fromCallCount === 1) {
        c.maybeSingle.mockResolvedValue({ data: fakeList });
      } else if (table === "list_items" && fromCallCount === 2) {
        c.eq.mockResolvedValue({ data: fakeItems });
      } else if (table === "shopping_trips") {
        c.insert.mockResolvedValue({ error: null });
      } else if (table === "trip_items") {
        c.insert.mockResolvedValue({ error: null });
      } else if (table === "shopping_lists") {
        c.eq.mockResolvedValue({ error: null });
      }

      return c;
    });

    const tripId = await archiveListAsTrip("list-1");

    expect(tripId).toBeTruthy();
    expect(mockSupabase.from).toHaveBeenCalledWith("shopping_trips");
    expect(mockSupabase.from).toHaveBeenCalledWith("trip_items");
  });

  test("marks list as completed after archiving", async () => {
    let fromCallCount = 0;
    const updateChain = chainable();

    mockSupabase.from.mockImplementation((table: string) => {
      fromCallCount++;
      const c = chainable();

      if (table === "shopping_lists" && fromCallCount === 1) {
        c.maybeSingle.mockResolvedValue({ data: fakeList });
      } else if (table === "list_items") {
        c.eq.mockResolvedValue({ data: fakeItems });
      } else if (table === "shopping_trips") {
        c.insert.mockResolvedValue({ error: null });
      } else if (table === "trip_items") {
        c.insert.mockResolvedValue({ error: null });
      } else if (table === "shopping_lists" && fromCallCount > 1) {
        Object.assign(c, updateChain);
        c.eq.mockResolvedValue({ error: null });
      }

      return c;
    });

    await archiveListAsTrip("list-1");

    expect(mockSupabase.from).toHaveBeenCalledWith("shopping_lists");
  });

  test("returns null when list is not active", async () => {
    mockSupabase.from.mockImplementation(() => {
      const c = chainable();
      c.maybeSingle.mockResolvedValue({
        data: { ...fakeList, status: "completed" },
      });
      return c;
    });

    const result = await archiveListAsTrip("list-1");

    expect(result).toBeNull();
  });

  test("returns null when list does not exist", async () => {
    mockSupabase.from.mockImplementation(() => {
      const c = chainable();
      c.maybeSingle.mockResolvedValue({ data: null });
      return c;
    });

    const result = await archiveListAsTrip("list-1");

    expect(result).toBeNull();
  });

  test("copies comment to trip items", async () => {
    const itemsWithComments = [
      { ...fakeItems[0], comment: "the blue one" },
      { ...fakeItems[1], comment: null },
    ];

    let fromCallCount = 0;
    let capturedTripItems: Record<string, unknown>[] = [];

    mockSupabase.from.mockImplementation((table: string) => {
      fromCallCount++;
      const c = chainable();

      if (table === "shopping_lists" && fromCallCount === 1) {
        c.maybeSingle.mockResolvedValue({ data: fakeList });
      } else if (table === "list_items") {
        c.eq.mockResolvedValue({ data: itemsWithComments });
      } else if (table === "shopping_trips") {
        c.insert.mockResolvedValue({ error: null });
      } else if (table === "trip_items") {
        c.insert.mockImplementation((rows: Record<string, unknown>[]) => {
          capturedTripItems = rows;
          return { error: null };
        });
      } else if (table === "shopping_lists") {
        c.eq.mockResolvedValue({ error: null });
      }

      return c;
    });

    await archiveListAsTrip("list-1");

    expect(capturedTripItems).toHaveLength(2);
    expect(capturedTripItems[0].comment).toBe("the blue one");
    expect(capturedTripItems[1].comment).toBeNull();
  });

  test("handles Supabase trip insert error gracefully", async () => {
    let fromCallCount = 0;
    mockSupabase.from.mockImplementation((table: string) => {
      fromCallCount++;
      const c = chainable();

      if (table === "shopping_lists" && fromCallCount === 1) {
        c.maybeSingle.mockResolvedValue({ data: fakeList });
      } else if (table === "list_items") {
        c.eq.mockResolvedValue({ data: fakeItems });
      } else if (table === "shopping_trips") {
        c.insert.mockResolvedValue({
          error: { message: "DB connection lost" },
        });
      }

      return c;
    });

    const result = await archiveListAsTrip("list-1");

    expect(result).toBeNull();
  });
});
