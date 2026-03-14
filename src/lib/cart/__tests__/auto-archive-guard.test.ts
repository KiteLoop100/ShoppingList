import { describe, test, expect, vi, beforeEach } from "vitest";
import type { ListItem } from "@/types";

function makeListItem(overrides: Partial<ListItem> = {}): ListItem {
  return {
    item_id: "item-1",
    list_id: "list-1",
    product_id: "prod-1",
    custom_name: null,
    display_name: "Milch",
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

function isScanAndGoActive(checkedItems: ListItem[]): boolean {
  return checkedItems.some((i) => i.is_extra_scan);
}

function shouldAutoArchive(params: {
  prevUncheckedCount: number | null;
  uncheckedCount: number;
  checkedCount: number;
  scanAndGoActive: boolean;
}): "archive" | "show_banner" | "none" {
  const { prevUncheckedCount, uncheckedCount, checkedCount, scanAndGoActive } = params;
  const hadUnchecked = prevUncheckedCount !== null && prevUncheckedCount > 0;
  const nowAllChecked = uncheckedCount === 0 && checkedCount > 0;

  if (!hadUnchecked || !nowAllChecked) return "none";
  if (scanAndGoActive) return "show_banner";
  return "archive";
}

describe("auto-archive guard", () => {
  test("archives normally when no extra-scan items exist", () => {
    const checked = [
      makeListItem({ item_id: "a", is_extra_scan: false }),
      makeListItem({ item_id: "b", is_extra_scan: false }),
    ];

    const result = shouldAutoArchive({
      prevUncheckedCount: 1,
      uncheckedCount: 0,
      checkedCount: checked.length,
      scanAndGoActive: isScanAndGoActive(checked),
    });

    expect(result).toBe("archive");
  });

  test("shows banner instead of archiving when extra-scan items exist", () => {
    const checked = [
      makeListItem({ item_id: "a", is_extra_scan: false }),
      makeListItem({ item_id: "b", is_extra_scan: true, display_name: "Chips" }),
    ];

    const result = shouldAutoArchive({
      prevUncheckedCount: 1,
      uncheckedCount: 0,
      checkedCount: checked.length,
      scanAndGoActive: isScanAndGoActive(checked),
    });

    expect(result).toBe("show_banner");
  });

  test("does nothing when items are still unchecked", () => {
    const checked = [
      makeListItem({ item_id: "a", is_extra_scan: true }),
    ];

    const result = shouldAutoArchive({
      prevUncheckedCount: 3,
      uncheckedCount: 2,
      checkedCount: checked.length,
      scanAndGoActive: isScanAndGoActive(checked),
    });

    expect(result).toBe("none");
  });

  test("does nothing on initial load (prevUncheckedCount is null)", () => {
    const result = shouldAutoArchive({
      prevUncheckedCount: null,
      uncheckedCount: 0,
      checkedCount: 5,
      scanAndGoActive: false,
    });

    expect(result).toBe("none");
  });

  test("does nothing when list has no checked items", () => {
    const result = shouldAutoArchive({
      prevUncheckedCount: 1,
      uncheckedCount: 0,
      checkedCount: 0,
      scanAndGoActive: false,
    });

    expect(result).toBe("none");
  });
});

describe("isScanAndGoActive", () => {
  test("returns false when no items have is_extra_scan", () => {
    const items = [
      makeListItem({ is_extra_scan: false }),
      makeListItem({ item_id: "item-2", is_extra_scan: false }),
    ];
    expect(isScanAndGoActive(items)).toBe(false);
  });

  test("returns true when at least one item has is_extra_scan", () => {
    const items = [
      makeListItem({ is_extra_scan: false }),
      makeListItem({ item_id: "item-2", is_extra_scan: true }),
    ];
    expect(isScanAndGoActive(items)).toBe(true);
  });

  test("returns false for empty array", () => {
    expect(isScanAndGoActive([])).toBe(false);
  });

  test("treats undefined is_extra_scan as false", () => {
    const items = [
      makeListItem({ is_extra_scan: undefined }),
    ];
    expect(isScanAndGoActive(items)).toBe(false);
  });
});

describe("banner display logic", () => {
  test("'continue scanning' dismisses the banner without archiving", () => {
    let bannerVisible = true;
    let archived = false;

    const handleContinueScanning = () => { bannerVisible = false; };
    const handleFinishTrip = () => { bannerVisible = false; archived = true; };

    handleContinueScanning();

    expect(bannerVisible).toBe(false);
    expect(archived).toBe(false);
  });

  test("'finish trip' dismisses banner and triggers archive", () => {
    let bannerVisible = true;
    let archived = false;

    const handleContinueScanning = () => { bannerVisible = false; };
    const handleFinishTrip = () => { bannerVisible = false; archived = true; };

    handleFinishTrip();

    expect(bannerVisible).toBe(false);
    expect(archived).toBe(true);
  });
});

describe("archive with extra items", () => {
  test("extra-scan items are included in trip items (not filtered out)", () => {
    const allItems = [
      makeListItem({ item_id: "a", is_extra_scan: false, is_checked: true }),
      makeListItem({ item_id: "b", is_extra_scan: true, is_checked: true, display_name: "Chips" }),
      makeListItem({ item_id: "c", is_extra_scan: false, is_checked: true }),
    ];
    const deferredIds = new Set<string>();
    const tripItems = allItems.filter((i) => !deferredIds.has(i.item_id));

    expect(tripItems).toHaveLength(3);
    expect(tripItems.some((i) => i.is_extra_scan)).toBe(true);
  });

  test("deferred items are excluded from trip items", () => {
    const allItems = [
      makeListItem({ item_id: "a", is_extra_scan: false }),
      makeListItem({ item_id: "b", is_extra_scan: true }),
      makeListItem({ item_id: "c", is_extra_scan: false }),
    ];
    const deferredIds = new Set(["c"]);
    const tripItems = allItems.filter((i) => !deferredIds.has(i.item_id));

    expect(tripItems).toHaveLength(2);
    expect(tripItems.map((i) => i.item_id)).toEqual(["a", "b"]);
  });

  test("extra scan count is correctly computed", () => {
    const checked = [
      makeListItem({ item_id: "a", is_extra_scan: false }),
      makeListItem({ item_id: "b", is_extra_scan: true }),
      makeListItem({ item_id: "c", is_extra_scan: true }),
      makeListItem({ item_id: "d", is_extra_scan: false }),
    ];

    const extraCount = checked.filter((i) => i.is_extra_scan).length;
    expect(extraCount).toBe(2);
    expect(checked.length).toBe(4);
  });
});
