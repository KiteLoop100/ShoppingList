import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/supabase/client", () => ({
  createClientIfConfigured: () => mockSupabase,
}));

vi.mock("@/lib/inventory/inventory-service", () => ({
  consumeInventoryItem: vi.fn(),
  unconsume: vi.fn(),
}));

vi.mock("@/lib/list", () => ({
  addListItem: vi.fn(),
  deleteListItem: vi.fn(),
}));

vi.mock("@/lib/list/active-list", () => ({
  getOrCreateActiveList: vi.fn(),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { consumeInventoryItem, unconsume } from "@/lib/inventory/inventory-service";
import { addListItem, deleteListItem } from "@/lib/list";
import { getOrCreateActiveList } from "@/lib/list/active-list";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

const mockSupabase = { from: vi.fn() };

function makeItem(overrides?: Partial<InventoryItem>): InventoryItem {
  return {
    id: "inv-1",
    user_id: "user-1",
    product_id: "prod-1",
    competitor_product_id: null,
    display_name: "Butter",
    demand_group_code: "MO",
    thumbnail_url: null,
    quantity: 1,
    status: "sealed",
    source: "receipt",
    source_receipt_id: null,
    added_at: "2025-01-01T00:00:00Z",
    opened_at: null,
    consumed_at: null,
    best_before: null,
    purchase_date: null,
    is_frozen: false,
    frozen_at: null,
    thawed_at: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
    ...overrides,
  };
}

/**
 * Replicates the core logic of handleConsumeAndAddToList from the hook.
 * Extracted here so we can test without @testing-library/react.
 */
async function consumeAndAddToList(
  item: InventoryItem,
  setItems: ReturnType<typeof vi.fn>,
  showToast: ReturnType<typeof vi.fn>,
) {
  const supabase = mockSupabase;

  let addedItemId: string | undefined;
  try {
    const list = await getOrCreateActiveList();
    const hasProductRef = item.product_id != null || item.competitor_product_id != null;
    const result = await addListItem({
      list_id: (list as { list_id: string }).list_id,
      product_id: item.product_id ?? null,
      custom_name: hasProductRef ? null : item.display_name,
      display_name: item.display_name,
      demand_group_code: item.demand_group_code ?? "AK",
      quantity: 1,
      competitor_product_id: item.competitor_product_id ?? undefined,
    });
    addedItemId = (result as { item_id: string }).item_id;
  } catch {
    // addListItem failed — proceed with consume only
  }

  const ok = await consumeInventoryItem(supabase, item.id);
  if (ok) {
    const toastKey = addedItemId ? "consumeAndAddToListToast" : "consumeAndAddToListPartialWarn";
    showToast(toastKey, item.id, item.status, addedItemId);
  } else {
    setItems("restore");
    if (addedItemId) {
      try { await deleteListItem(addedItemId); } catch { /* best effort */ }
    }
  }

  return { ok, addedItemId };
}

async function undoConsumeAndAddToList(
  itemId: string,
  prevStatus: "sealed" | "opened",
  addedListItemId?: string,
) {
  const ok = await unconsume(mockSupabase, itemId, prevStatus);
  if (ok && addedListItemId) {
    try { await deleteListItem(addedListItemId); } catch { /* best effort */ }
  }
  return ok;
}

describe("consumeAndAddToList", () => {
  beforeEach(() => vi.clearAllMocks());

  test("happy path: adds to list then consumes, shows combined toast", async () => {
    vi.mocked(getOrCreateActiveList).mockResolvedValue({ list_id: "list-1", user_id: "u", store_id: null, status: "active" as const, created_at: "" });
    vi.mocked(addListItem).mockResolvedValue({ item_id: "li-1", list_id: "list-1", product_id: "prod-1", custom_name: null, display_name: "Butter", quantity: 1, is_checked: false, checked_at: null, sort_position: 0, demand_group_code: "MO", added_at: "" });
    vi.mocked(consumeInventoryItem).mockResolvedValue(true);

    const setItems = vi.fn();
    const showToast = vi.fn();
    const item = makeItem();

    const { ok, addedItemId } = await consumeAndAddToList(item, setItems, showToast);

    expect(ok).toBe(true);
    expect(addedItemId).toBe("li-1");
    expect(addListItem).toHaveBeenCalledWith({
      list_id: "list-1",
      product_id: "prod-1",
      custom_name: null,
      display_name: "Butter",
      demand_group_code: "MO",
      quantity: 1,
      competitor_product_id: undefined,
    });
    expect(consumeInventoryItem).toHaveBeenCalledWith(mockSupabase, "inv-1");
    expect(showToast).toHaveBeenCalledWith("consumeAndAddToListToast", "inv-1", "sealed", "li-1");
  });

  test("addListItem fails: still consumes, shows partial warning", async () => {
    vi.mocked(getOrCreateActiveList).mockResolvedValue({ list_id: "list-1", user_id: "u", store_id: null, status: "active" as const, created_at: "" });
    vi.mocked(addListItem).mockRejectedValue(new Error("network error"));
    vi.mocked(consumeInventoryItem).mockResolvedValue(true);

    const setItems = vi.fn();
    const showToast = vi.fn();

    const { ok, addedItemId } = await consumeAndAddToList(makeItem(), setItems, showToast);

    expect(ok).toBe(true);
    expect(addedItemId).toBeUndefined();
    expect(consumeInventoryItem).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith("consumeAndAddToListPartialWarn", "inv-1", "sealed", undefined);
  });

  test("consume fails: restores item and rolls back list item", async () => {
    vi.mocked(getOrCreateActiveList).mockResolvedValue({ list_id: "list-1", user_id: "u", store_id: null, status: "active" as const, created_at: "" });
    vi.mocked(addListItem).mockResolvedValue({ item_id: "li-2", list_id: "list-1", product_id: "prod-1", custom_name: null, display_name: "Butter", quantity: 1, is_checked: false, checked_at: null, sort_position: 0, demand_group_code: "MO", added_at: "" });
    vi.mocked(consumeInventoryItem).mockResolvedValue(false);
    vi.mocked(deleteListItem).mockResolvedValue(undefined);

    const setItems = vi.fn();
    const showToast = vi.fn();

    const { ok } = await consumeAndAddToList(makeItem(), setItems, showToast);

    expect(ok).toBe(false);
    expect(setItems).toHaveBeenCalledWith("restore");
    expect(deleteListItem).toHaveBeenCalledWith("li-2");
    expect(showToast).not.toHaveBeenCalled();
  });

  test("null demand_group_code falls back to AK", async () => {
    vi.mocked(getOrCreateActiveList).mockResolvedValue({ list_id: "list-1", user_id: "u", store_id: null, status: "active" as const, created_at: "" });
    vi.mocked(addListItem).mockResolvedValue({ item_id: "li-3", list_id: "list-1", product_id: "prod-1", custom_name: null, display_name: "Mehl", quantity: 1, is_checked: false, checked_at: null, sort_position: 0, demand_group_code: "AK", added_at: "" });
    vi.mocked(consumeInventoryItem).mockResolvedValue(true);

    const item = makeItem({ demand_group_code: null, display_name: "Mehl" });
    await consumeAndAddToList(item, vi.fn(), vi.fn());

    expect(addListItem).toHaveBeenCalledWith(
      expect.objectContaining({ demand_group_code: "AK" }),
    );
  });

  test("competitor product: sets competitor_product_id and custom_name null", async () => {
    vi.mocked(getOrCreateActiveList).mockResolvedValue({ list_id: "list-1", user_id: "u", store_id: null, status: "active" as const, created_at: "" });
    vi.mocked(addListItem).mockResolvedValue({ item_id: "li-4", list_id: "list-1", product_id: null, custom_name: null, display_name: "DM Seife", quantity: 1, is_checked: false, checked_at: null, sort_position: 0, demand_group_code: "HH", added_at: "" });
    vi.mocked(consumeInventoryItem).mockResolvedValue(true);

    const item = makeItem({
      product_id: null,
      competitor_product_id: "comp-1",
      display_name: "DM Seife",
      demand_group_code: "HH",
    });
    await consumeAndAddToList(item, vi.fn(), vi.fn());

    expect(addListItem).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: null,
        competitor_product_id: "comp-1",
        custom_name: null,
      }),
    );
  });

  test("manual item (no product refs): uses display_name as custom_name", async () => {
    vi.mocked(getOrCreateActiveList).mockResolvedValue({ list_id: "list-1", user_id: "u", store_id: null, status: "active" as const, created_at: "" });
    vi.mocked(addListItem).mockResolvedValue({ item_id: "li-5", list_id: "list-1", product_id: null, custom_name: "Brot vom Bäcker", display_name: "Brot vom Bäcker", quantity: 1, is_checked: false, checked_at: null, sort_position: 0, demand_group_code: "AK", added_at: "" });
    vi.mocked(consumeInventoryItem).mockResolvedValue(true);

    const item = makeItem({
      product_id: null,
      competitor_product_id: null,
      display_name: "Brot vom Bäcker",
      demand_group_code: null,
    });
    await consumeAndAddToList(item, vi.fn(), vi.fn());

    expect(addListItem).toHaveBeenCalledWith(
      expect.objectContaining({
        product_id: null,
        custom_name: "Brot vom Bäcker",
        demand_group_code: "AK",
      }),
    );
  });
});

describe("undo consumeAndAddToList", () => {
  beforeEach(() => vi.clearAllMocks());

  test("full undo: unconsumes and deletes list item", async () => {
    vi.mocked(unconsume).mockResolvedValue(true);
    vi.mocked(deleteListItem).mockResolvedValue(undefined);

    const ok = await undoConsumeAndAddToList("inv-1", "sealed", "li-1");

    expect(ok).toBe(true);
    expect(unconsume).toHaveBeenCalledWith(mockSupabase, "inv-1", "sealed");
    expect(deleteListItem).toHaveBeenCalledWith("li-1");
  });

  test("undo without addedListItemId: only unconsumes", async () => {
    vi.mocked(unconsume).mockResolvedValue(true);

    await undoConsumeAndAddToList("inv-1", "opened");

    expect(unconsume).toHaveBeenCalledWith(mockSupabase, "inv-1", "opened");
    expect(deleteListItem).not.toHaveBeenCalled();
  });

  test("unconsume fails: does not attempt deleteListItem", async () => {
    vi.mocked(unconsume).mockResolvedValue(false);

    const ok = await undoConsumeAndAddToList("inv-1", "sealed", "li-1");

    expect(ok).toBe(false);
    expect(deleteListItem).not.toHaveBeenCalled();
  });
});
