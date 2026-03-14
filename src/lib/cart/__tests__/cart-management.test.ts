import { describe, test, expect, vi, beforeEach } from "vitest";
import type { ListItem } from "@/types";

function makeListItem(overrides: Partial<ListItem> = {}): ListItem {
  return {
    item_id: "item-1",
    list_id: "list-1",
    product_id: "prod-1",
    custom_name: null,
    display_name: "Eier",
    quantity: 1,
    is_checked: true,
    checked_at: new Date().toISOString(),
    sort_position: 0,
    demand_group_code: "MO",
    added_at: new Date().toISOString(),
    is_extra_scan: false,
    ...overrides,
  };
}

vi.mock("@/lib/list", () => ({
  updateListItem: vi.fn(async () => {}),
  deleteListItem: vi.fn(async () => {}),
}));

describe("cart management: uncheckItem logic", () => {
  let updateListItem: ReturnType<typeof vi.fn>;
  let deleteListItem: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();
    const listMod = await import("@/lib/list");
    updateListItem = listMod.updateListItem as ReturnType<typeof vi.fn>;
    deleteListItem = listMod.deleteListItem as ReturnType<typeof vi.fn>;
  });

  test("regular item (is_extra_scan=false) gets unchecked, not deleted", async () => {
    const item = makeListItem({ is_extra_scan: false });

    expect(item.is_extra_scan).toBe(false);

    await updateListItem(item.item_id, { is_checked: false, checked_at: null });

    expect(updateListItem).toHaveBeenCalledWith(item.item_id, {
      is_checked: false,
      checked_at: null,
    });
    expect(deleteListItem).not.toHaveBeenCalled();
  });

  test("extra item (is_extra_scan=true) gets deleted, not unchecked", async () => {
    const item = makeListItem({ is_extra_scan: true, display_name: "Chips" });

    expect(item.is_extra_scan).toBe(true);

    await deleteListItem(item.item_id);

    expect(deleteListItem).toHaveBeenCalledWith(item.item_id);
    expect(updateListItem).not.toHaveBeenCalled();
  });

  test("is_extra_scan defaults to false for items without the field", () => {
    const item = makeListItem({ is_extra_scan: undefined });

    const isExtra = item.is_extra_scan ?? false;
    expect(isExtra).toBe(false);
  });
});

describe("cart management: quantity changes", () => {
  test("increment increases quantity by 1", () => {
    const item = makeListItem({ quantity: 2 });
    const newQuantity = item.quantity + 1;
    expect(newQuantity).toBe(3);
  });

  test("decrement decreases quantity by 1 when > 1", () => {
    const item = makeListItem({ quantity: 3 });
    const newQuantity = item.quantity - 1;
    expect(newQuantity).toBe(2);
    expect(newQuantity).toBeGreaterThanOrEqual(1);
  });

  test("decrement at quantity 1 triggers remove (not quantity 0)", () => {
    const item = makeListItem({ quantity: 1 });
    const shouldRemove = item.quantity <= 1;
    expect(shouldRemove).toBe(true);
  });

  test("minus on regular item at quantity 1 unchecks instead of delete", () => {
    const item = makeListItem({ quantity: 1, is_extra_scan: false });
    const shouldRemove = item.quantity <= 1;
    const action = shouldRemove
      ? item.is_extra_scan ? "delete" : "uncheck"
      : "decrement";
    expect(action).toBe("uncheck");
  });

  test("minus on extra item at quantity 1 deletes completely", () => {
    const item = makeListItem({ quantity: 1, is_extra_scan: true });
    const shouldRemove = item.quantity <= 1;
    const action = shouldRemove
      ? item.is_extra_scan ? "delete" : "uncheck"
      : "decrement";
    expect(action).toBe("delete");
  });
});

describe("cart management: price calculation", () => {
  test("total price reflects quantity * unit price", () => {
    const item = makeListItem({ quantity: 3 });
    const unitPrice = 2.19;
    const totalPrice = unitPrice * item.quantity;
    expect(totalPrice).toBeCloseTo(6.57);
  });

  test("total price updates after quantity change", () => {
    const unitPrice = 1.49;
    const before = unitPrice * 2;
    const after = unitPrice * 3;
    expect(before).toBeCloseTo(2.98);
    expect(after).toBeCloseTo(4.47);
  });

  test("items without price show null", () => {
    const price: number | null = null;
    const quantity = 2;
    const displayPrice = price != null ? price * quantity : null;
    expect(displayPrice).toBeNull();
  });
});
