import { vi, describe, test, expect, beforeEach, afterEach } from "vitest";
import type { ListItemWithMeta } from "@/lib/list/list-helpers";

vi.mock("react", () => ({
  useCallback: (fn: Function) => fn,
  useRef: (val: unknown) => ({ current: val }),
}));

const mockUpdateListItem = vi.fn().mockResolvedValue(undefined);
const mockDeleteListItem = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/list", () => ({
  updateListItem: (...args: unknown[]) => mockUpdateListItem(...args),
  deleteListItem: (...args: unknown[]) => mockDeleteListItem(...args),
}));

vi.mock("@/lib/competitor-products/competitor-product-service", () => ({
  recordCompetitorPurchase: vi.fn().mockResolvedValue(undefined),
}));

const mockTouchAutoReorder = vi.fn().mockResolvedValue(null);
vi.mock("@/lib/list/auto-reorder-service", () => ({
  touchAutoReorderOnCheckoff: (...args: unknown[]) => mockTouchAutoReorder(...args),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { useListMutations } from "../use-list-mutations";

function makeItem(overrides: Partial<ListItemWithMeta> = {}): ListItemWithMeta {
  return {
    item_id: "item-1",
    list_id: "list-1",
    product_id: "prod-1",
    custom_name: null,
    display_name: "Test Item",
    quantity: 1,
    is_checked: false,
    checked_at: null,
    sort_position: 0,
    demand_group_code: "01",
    added_at: "2026-01-01T00:00:00Z",
    demand_group_name: "Test",
    demand_group_icon: "🧪",
    demand_group_sort_position: 1,
    category_name: "Test",
    category_icon: "🧪",
    category_sort_position: 1,
    price: null,
    ...overrides,
  };
}

type SetState<T> = React.Dispatch<React.SetStateAction<T>>;

function createMockDeps(
  unchecked: ListItemWithMeta[] = [],
  checked: ListItemWithMeta[] = [],
  deferred: ListItemWithMeta[] = [],
) {
  const uncheckedRef = { current: unchecked };
  const checkedRef = { current: checked };
  const deferredRef = { current: deferred };

  const applySetState = <T>(ref: { current: T }): SetState<T> =>
    (action: T | ((prev: T) => T)) => {
      ref.current = typeof action === "function"
        ? (action as (prev: T) => T)(ref.current)
        : action;
    };

  return {
    uncheckedRef,
    checkedRef,
    deferredRef,
    setUnchecked: vi.fn(applySetState(uncheckedRef)),
    setChecked: vi.fn(applySetState(checkedRef)),
    setDeferred: vi.fn(applySetState(deferredRef)),
    debouncedRefetch: vi.fn(),
    refetchRef: { current: vi.fn() },
    autoReorderCacheRef: { current: null as import("@/lib/list/auto-reorder-service").AutoReorderSetting[] | null },
  };
}

describe("useListMutations", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ── setItemQuantity ──────────────────────────────────────────────────

  test("setItemQuantity updates quantity across all lists", async () => {
    const item = makeItem({ item_id: "q1", quantity: 1 });
    const deps = createMockDeps([item], [], []);

    const { setItemQuantity } = useListMutations(deps);
    await setItemQuantity("q1", 3);

    expect(deps.setUnchecked).toHaveBeenCalled();
    expect(deps.setChecked).toHaveBeenCalled();
    expect(deps.setDeferred).toHaveBeenCalled();
    expect(deps.uncheckedRef.current[0].quantity).toBe(3);
    expect(mockUpdateListItem).toHaveBeenCalledWith("q1", { quantity: 3 });
    expect(deps.debouncedRefetch).toHaveBeenCalled();
  });

  test("setItemQuantity ignores quantity < 1", async () => {
    const item = makeItem({ item_id: "q2", quantity: 2 });
    const deps = createMockDeps([item]);

    const { setItemQuantity } = useListMutations(deps);
    await setItemQuantity("q2", 0);

    expect(mockUpdateListItem).not.toHaveBeenCalled();
    expect(deps.uncheckedRef.current[0].quantity).toBe(2);
  });

  test("setItemQuantity reverts on DB error", async () => {
    mockUpdateListItem.mockRejectedValueOnce(new Error("DB error"));
    const item = makeItem({ item_id: "q3", quantity: 1 });
    const deps = createMockDeps([item]);

    const { setItemQuantity } = useListMutations(deps);
    await setItemQuantity("q3", 5);

    expect(deps.refetchRef.current).toHaveBeenCalled();
  });

  // ── removeItem ───────────────────────────────────────────────────────

  test("removeItem removes item optimistically", async () => {
    const item = makeItem({ item_id: "r1" });
    const deps = createMockDeps([item]);

    const { removeItem } = useListMutations(deps);
    await removeItem("r1");

    expect(deps.uncheckedRef.current).toHaveLength(0);
    expect(mockDeleteListItem).toHaveBeenCalledWith("r1");
    expect(deps.debouncedRefetch).toHaveBeenCalled();
  });

  test("removeItem reverts all lists on DB error (optimistic rollback)", async () => {
    mockDeleteListItem.mockRejectedValueOnce(new Error("DB error"));
    const item = makeItem({ item_id: "r2" });
    const origUnchecked = [item];
    const deps = createMockDeps([...origUnchecked], [], []);

    const { removeItem } = useListMutations(deps);
    await removeItem("r2");

    // After error, the last setUnchecked call restores originals
    const lastCall = deps.setUnchecked.mock.calls.at(-1)![0];
    expect(lastCall).toEqual(origUnchecked);
  });

  // ── setItemChecked ───────────────────────────────────────────────────

  test("setItemChecked marks item as checked and moves to checked list after delay", async () => {
    const item = makeItem({ item_id: "c1", is_checked: false });
    const deps = createMockDeps([item]);

    const { setItemChecked } = useListMutations(deps);
    await setItemChecked("c1", true);

    // Before timer fires, item is still in unchecked but marked checked
    expect(deps.setUnchecked).toHaveBeenCalled();

    // Advance past CHECK_FEEDBACK_MS (350ms)
    vi.advanceTimersByTime(350);

    expect(deps.uncheckedRef.current.find(i => i.item_id === "c1")).toBeUndefined();
    expect(deps.checkedRef.current.find(i => i.item_id === "c1")).toBeDefined();
    expect(mockUpdateListItem).toHaveBeenCalledWith("c1", expect.objectContaining({ is_checked: true }));
  });

  test("setItemChecked unchecking moves item back to unchecked immediately", async () => {
    const item = makeItem({ item_id: "c2", is_checked: true, checked_at: "2026-01-01T00:00:00Z" });
    const deps = createMockDeps([], [item]);

    const { setItemChecked } = useListMutations(deps);
    await setItemChecked("c2", false);

    expect(deps.checkedRef.current.find(i => i.item_id === "c2")).toBeUndefined();
    expect(deps.uncheckedRef.current.find(i => i.item_id === "c2")).toBeDefined();
    expect(deps.uncheckedRef.current.find(i => i.item_id === "c2")!.is_checked).toBe(false);
    expect(deps.debouncedRefetch).toHaveBeenCalled();
  });

  // ── deferItem ────────────────────────────────────────────────────────

  test("deferItem moves item from unchecked to deferred with tomorrow's date", async () => {
    vi.setSystemTime(new Date("2026-03-04T10:00:00Z"));
    const item = makeItem({ item_id: "d1" });
    const deps = createMockDeps([item]);

    const { deferItem } = useListMutations(deps);
    await deferItem("d1");

    expect(deps.uncheckedRef.current.find(i => i.item_id === "d1")).toBeUndefined();
    const deferredItem = deps.deferredRef.current.find(i => i.item_id === "d1");
    expect(deferredItem).toBeDefined();
    expect(deferredItem!.deferred_reason).toBe("manual");
    expect(deferredItem!.available_from).toBe("2026-03-05");
    expect(mockUpdateListItem).toHaveBeenCalledWith("d1", { deferred_until: "2026-03-05" });
  });

  test("deferItem reverts on DB error", async () => {
    vi.setSystemTime(new Date("2026-03-04T10:00:00Z"));
    mockUpdateListItem.mockRejectedValueOnce(new Error("DB error"));
    const item = makeItem({ item_id: "d2" });
    const deps = createMockDeps([item]);

    const { deferItem } = useListMutations(deps);
    await deferItem("d2");

    // After error: item removed from deferred, added back to unchecked
    expect(deps.deferredRef.current.find(i => i.item_id === "d2")).toBeUndefined();
    expect(deps.uncheckedRef.current.find(i => i.item_id === "d2")).toBeDefined();
  });

  // ── undeferItem ──────────────────────────────────────────────────────

  test("undeferItem moves manually-deferred item back to unchecked", async () => {
    const item = makeItem({
      item_id: "u1",
      is_deferred: true,
      deferred_reason: "manual",
      available_from: "2026-03-05",
      deferred_until: "2026-03-05",
    });
    const deps = createMockDeps([], [], [item]);

    const { undeferItem } = useListMutations(deps);
    await undeferItem("u1");

    expect(deps.deferredRef.current.find(i => i.item_id === "u1")).toBeUndefined();
    const restored = deps.uncheckedRef.current.find(i => i.item_id === "u1");
    expect(restored).toBeDefined();
    expect(restored!.is_deferred).toBe(false);
    expect(mockUpdateListItem).toHaveBeenCalledWith("u1", { deferred_until: null });
  });

  test("undeferItem ignores non-manual deferred items", async () => {
    const item = makeItem({
      item_id: "u2",
      is_deferred: true,
      deferred_reason: "special",
    });
    const deps = createMockDeps([], [], [item]);

    const { undeferItem } = useListMutations(deps);
    await undeferItem("u2");

    expect(mockUpdateListItem).not.toHaveBeenCalled();
    expect(deps.deferredRef.current).toHaveLength(1);
  });
});
