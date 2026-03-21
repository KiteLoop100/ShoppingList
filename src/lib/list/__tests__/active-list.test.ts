import { vi, describe, test, expect, beforeEach } from "vitest";

// ── Supabase chain builder ────────────────────────────────────────────────

function createChain(resolveValue: unknown = { data: null, error: null }) {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  const self = () => chain;
  chain.select = vi.fn(self);
  chain.insert = vi.fn(self);
  chain.update = vi.fn(self);
  chain.delete = vi.fn(self);
  chain.eq = vi.fn(self);
  chain.in = vi.fn(self);
  chain.order = vi.fn(self);
  chain.limit = vi.fn(() => resolveValue);
  chain.single = vi.fn(() => resolveValue);
  chain.maybeSingle = vi.fn(() => resolveValue);
  chain.then = vi.fn((resolve: (v: unknown) => void) => resolve(resolveValue));
  return chain;
}

// Proxy: await chain → resolveValue
function awaitableChain(resolveValue: unknown = { data: null, error: null }) {
  const chain = createChain(resolveValue);
  return new Proxy(chain, {
    get(target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => resolve(resolveValue);
      }
      return target[prop as string];
    },
  });
}

const mockGetUser = vi.fn();

let fromHandler: (table: string) => Record<string, ReturnType<typeof vi.fn>>;

const mockSupabase = {
  auth: { getUser: mockGetUser },
  from: vi.fn((table: string) => fromHandler(table)),
};

vi.mock("@/lib/supabase/client", () => ({
  createClientIfConfigured: () => mockSupabase,
}));

vi.mock("@/lib/utils/generate-id", () => ({
  generateId: () => "generated-uuid",
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import {
  getOrCreateActiveList,
  getListItems,
  resetActiveListCache,
} from "../active-list";
import {
  addListItem,
  updateListItem,
  deleteListItem,
  updateShoppingListNotes,
} from "../active-list-write";

// ── Tests ──────────────────────────────────────────────────────────────────

describe("getOrCreateActiveList", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromHandler = () => createChain();
  });

  test("returns existing list when one exists", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const existingList = {
      list_id: "list-1",
      user_id: "user-1",
      store_id: null,
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      completed_at: null,
    };

    fromHandler = (table: string) => {
      if (table === "shopping_lists") {
        return createChain({ data: [existingList] });
      }
      return createChain();
    };

    const result = await getOrCreateActiveList();

    expect(result.list_id).toBe("list-1");
    expect(result.status).toBe("active");
    expect(mockSupabase.from).toHaveBeenCalledWith("shopping_lists");
  });

  test("creates new list when none exists", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "user-1" } },
    });

    const newList = {
      list_id: "generated-uuid",
      user_id: "user-1",
      store_id: null,
      status: "active",
      created_at: "2026-01-01T00:00:00Z",
      completed_at: null,
    };

    let selectCallCount = 0;
    fromHandler = (table: string) => {
      if (table === "shopping_lists") {
        selectCallCount++;
        if (selectCallCount === 1) {
          return createChain({ data: [] });
        }
        return createChain({ data: newList, error: null });
      }
      return createChain();
    };

    const result = await getOrCreateActiveList();

    expect(result.list_id).toBe("generated-uuid");
    expect(result.status).toBe("active");
  });

  test("throws when user is not authenticated", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: null },
    });

    await expect(getOrCreateActiveList()).rejects.toThrow("Not authenticated");
  });
});

describe("resetActiveListCache", () => {
  test("is safe to call repeatedly", () => {
    expect(() => {
      resetActiveListCache();
      resetActiveListCache();
    }).not.toThrow();
  });
});

describe("getListItems", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromHandler = () => createChain();
  });

  test("returns items for a given list", async () => {
    const items = [
      {
        item_id: "item-1",
        list_id: "list-1",
        product_id: "prod-1",
        custom_name: null,
        display_name: "Milch",
        quantity: 2,
        is_checked: false,
        checked_at: null,
        sort_position: 1,
        demand_group_code: "01",
        added_at: "2026-01-01T00:00:00Z",
        deferred_until: null,
        buy_elsewhere_retailer: null,
        competitor_product_id: null,
      },
    ];

    fromHandler = (table: string) => {
      if (table === "list_items") {
        return awaitableChain({ data: items });
      }
      return createChain();
    };

    const result = await getListItems("list-1");

    expect(result).toHaveLength(1);
    expect(result[0].item_id).toBe("item-1");
    expect(result[0].display_name).toBe("Milch");
    expect(result[0].quantity).toBe(2);
    expect(mockSupabase.from).toHaveBeenCalledWith("list_items");
  });

  test("returns empty array when no data", async () => {
    fromHandler = () => awaitableChain({ data: null });

    const result = await getListItems("list-1");

    expect(result).toEqual([]);
  });
});

describe("addListItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromHandler = () => createChain();
  });

  test("adds item and returns created item", async () => {
    const newItem = {
      item_id: "generated-uuid",
      list_id: "list-1",
      product_id: "prod-1",
      custom_name: null,
      display_name: "Butter",
      quantity: 1,
      is_checked: false,
      checked_at: null,
      sort_position: -1000,
      demand_group_code: "02",
      added_at: "2026-01-01T00:00:00Z",
    };

    let listItemsCallCount = 0;
    fromHandler = (table: string) => {
      if (table === "list_items") {
        listItemsCallCount++;
        if (listItemsCallCount === 1) {
          return awaitableChain({ data: [] });
        }
        return createChain({ data: newItem, error: null });
      }
      return createChain();
    };

    const result = await addListItem({
      list_id: "list-1",
      product_id: "prod-1",
      custom_name: null,
      display_name: "Butter",
      demand_group_code: "02",
    });

    expect(result.display_name).toBe("Butter");
    expect(result.item_id).toBe("generated-uuid");
  });

  test("handles duplicate detection by incrementing quantity", async () => {
    const existingItem = {
      item_id: "existing-item",
      list_id: "list-1",
      product_id: "prod-1",
      custom_name: null,
      display_name: "Milch",
      quantity: 1,
      is_checked: false,
      checked_at: null,
      sort_position: 1,
      demand_group_code: "01",
      added_at: "2026-01-01T00:00:00Z",
      buy_elsewhere_retailer: null,
    };

    fromHandler = (table: string) => {
      if (table === "list_items") {
        return awaitableChain({ data: [existingItem] });
      }
      return createChain();
    };

    const result = await addListItem({
      list_id: "list-1",
      product_id: "prod-1",
      custom_name: null,
      display_name: "Milch",
      demand_group_code: "01",
    });

    expect(result.item_id).toBe("existing-item");
    expect(result.quantity).toBe(2);
  });
});

describe("updateListItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromHandler = () => createChain();
  });

  test("updates quantity", async () => {
    fromHandler = (table: string) => {
      if (table === "list_items") {
        return awaitableChain({ error: null });
      }
      return createChain();
    };

    await updateListItem("item-1", { quantity: 5 });

    expect(mockSupabase.from).toHaveBeenCalledWith("list_items");
  });

  test("throws on Supabase error", async () => {
    fromHandler = (table: string) => {
      if (table === "list_items") {
        return awaitableChain({ error: { message: "DB error" } });
      }
      return createChain();
    };

    await expect(
      updateListItem("item-1", { quantity: 5 })
    ).rejects.toThrow("updateListItem failed: DB error");
  });
});

describe("deleteListItem", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromHandler = () => createChain();
  });

  test("removes item", async () => {
    fromHandler = (table: string) => {
      if (table === "list_items") {
        return awaitableChain({ error: null });
      }
      return createChain();
    };

    await deleteListItem("item-1");

    expect(mockSupabase.from).toHaveBeenCalledWith("list_items");
  });

  test("handles error gracefully (returns without throwing)", async () => {
    fromHandler = (table: string) => {
      if (table === "list_items") {
        return awaitableChain({ error: { message: "Not found" } });
      }
      return createChain();
    };

    await expect(deleteListItem("nonexistent")).resolves.toBeUndefined();
  });
});

describe("updateShoppingListNotes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fromHandler = () => createChain();
  });

  test("updates notes on shopping_lists table", async () => {
    fromHandler = (table: string) => {
      if (table === "shopping_lists") {
        return awaitableChain({ error: null });
      }
      return createChain();
    };

    await updateShoppingListNotes("list-1", "Leergut mitbringen");

    expect(mockSupabase.from).toHaveBeenCalledWith("shopping_lists");
  });

  test("clears notes by passing null", async () => {
    fromHandler = (table: string) => {
      if (table === "shopping_lists") {
        return awaitableChain({ error: null });
      }
      return createChain();
    };

    await updateShoppingListNotes("list-1", null);

    expect(mockSupabase.from).toHaveBeenCalledWith("shopping_lists");
  });

  test("throws on Supabase error", async () => {
    fromHandler = (table: string) => {
      if (table === "shopping_lists") {
        return awaitableChain({ error: { message: "DB error" } });
      }
      return createChain();
    };

    await expect(
      updateShoppingListNotes("list-1", "test")
    ).rejects.toThrow("updateShoppingListNotes failed: DB error");
  });
});
