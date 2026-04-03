import { describe, test, expect } from "vitest";
import { formatListAsText } from "../format-list-text";
import type { ListItemWithMeta } from "../list-helpers";

function makeItem(overrides: Partial<ListItemWithMeta> = {}): ListItemWithMeta {
  return {
    item_id: "item-1",
    list_id: "list-1",
    product_id: null,
    custom_name: null,
    display_name: "Test Item",
    demand_group_code: "TK",
    quantity: 1,
    is_checked: false,
    sort_position: 0,
    added_at: new Date().toISOString(),
    checked_at: null,
    deferred_until: null,
    buy_elsewhere_retailer: null,
    competitor_product_id: null,
    demand_group_name: "Test",
    demand_group_icon: "📦",
    demand_group_sort_position: 0,
    category_name: "Test",
    category_icon: "📦",
    category_sort_position: 0,
    price: null,
    ...overrides,
  };
}

describe("formatListAsText", () => {
  test("formats unchecked items with quantity suffix when qty > 1", () => {
    const unchecked = [
      makeItem({ item_id: "a", display_name: "Milch", quantity: 1 }),
      makeItem({ item_id: "b", display_name: "Butter", quantity: 2 }),
      makeItem({ item_id: "c", display_name: "Eier", quantity: 3 }),
    ];
    const out = formatListAsText(unchecked, [], [], { grouped: false });

    expect(out.split("\n")).toEqual(["- Milch", "- Butter x2", "- Eier x3"]);
  });

  test("groups by category with icon headers when grouped", () => {
    const unchecked = [
      makeItem({
        item_id: "1",
        display_name: "Jogurt",
        category_name: "Molkerei",
        category_icon: "🥛",
      }),
      makeItem({
        item_id: "2",
        display_name: "Käse",
        category_name: "Molkerei",
        category_icon: "🥛",
      }),
      makeItem({
        item_id: "3",
        display_name: "Apfel",
        category_name: "Obst",
        category_icon: "🍎",
      }),
    ];
    const out = formatListAsText(unchecked, [], [], { grouped: true, locale: "de" });

    expect(out).toContain("🥛 Molkerei");
    expect(out).toContain("- Jogurt");
    expect(out).toContain("- Käse");
    expect(out).toContain("🍎 Obst");
    expect(out).toContain("- Apfel");
  });

  test("appends checked section when includeChecked is true", () => {
    const unchecked = [makeItem({ item_id: "u", display_name: "Offen" })];
    const checked = [makeItem({ item_id: "c", display_name: "Erledigt", is_checked: true })];
    const out = formatListAsText(unchecked, checked, [], {
      includeChecked: true,
      grouped: false,
      locale: "de",
    });

    expect(out).toContain("- Offen");
    expect(out).toContain("--- Erledigt ---");
    expect(out).toContain("- Erledigt");
  });

  test("uses English section headers when locale is en", () => {
    const unchecked = [makeItem({ display_name: "Milk" })];
    const checked = [makeItem({ item_id: "c", display_name: "Done item", is_checked: true })];
    const out = formatListAsText(unchecked, checked, [], {
      includeChecked: true,
      grouped: false,
      locale: "en",
    });

    expect(out).toContain("--- Done ---");
    expect(out).not.toContain("--- Erledigt ---");
  });

  test("includes non-elsewhere deferred under Später", () => {
    const deferred = [
      makeItem({
        item_id: "d1",
        display_name: "Angebot nächste Woche",
        deferred_reason: "special",
        is_deferred: true,
        category_name: "Aktion",
        category_icon: "🏷",
      }),
    ];
    const out = formatListAsText([], [], deferred, { grouped: false, locale: "de" });

    expect(out).toContain("--- Später ---");
    expect(out).toContain("- Angebot nächste Woche");
  });

  test("partitions buy-elsewhere deferred by retailer", () => {
    const deferred = [
      makeItem({
        item_id: "e1",
        display_name: "Bei REWE",
        deferred_reason: "elsewhere",
        buy_elsewhere_retailer: "REWE",
        is_deferred: true,
      }),
      makeItem({
        item_id: "e2",
        display_name: "Bei LIDL",
        deferred_reason: "elsewhere",
        buy_elsewhere_retailer: "LIDL",
        is_deferred: true,
      }),
    ];
    const out = formatListAsText([], [], deferred, { grouped: false, locale: "de" });

    expect(out).toContain("--- REWE ---");
    expect(out).toContain("- Bei REWE");
    expect(out).toContain("--- LIDL ---");
    expect(out).toContain("- Bei LIDL");
    expect(out).not.toContain("--- Später ---");
  });

  test("classifies item as elsewhere when only buy_elsewhere_retailer is set", () => {
    const deferred = [
      makeItem({
        item_id: "x",
        display_name: "Nur Händler gesetzt",
        buy_elsewhere_retailer: "dm",
        is_deferred: true,
      }),
    ];
    const out = formatListAsText([], [], deferred, { grouped: false });

    expect(out).toContain("--- dm ---");
    expect(out).toContain("- Nur Händler gesetzt");
  });

  test("returns empty-list placeholder when nothing to export", () => {
    expect(formatListAsText([], [], [], { locale: "de" })).toBe("(Leere Liste)");
    expect(formatListAsText([], [], [], { locale: "en" })).toBe("(Empty list)");
  });

  test("only checked without includeChecked yields empty placeholder", () => {
    const checked = [makeItem({ display_name: "Only checked", is_checked: true })];
    expect(formatListAsText([], checked, [], { includeChecked: false, locale: "de" })).toBe(
      "(Leere Liste)",
    );
  });

  test("mixed unchecked, deferred, elsewhere, and checked", () => {
    const unchecked = [makeItem({ item_id: "u", display_name: "Oben" })];
    const checked = [makeItem({ item_id: "c", display_name: "Abgehakt", is_checked: true })];
    const deferred = [
      makeItem({
        item_id: "d",
        display_name: "Später kaufen",
        deferred_reason: "manual",
        is_deferred: true,
      }),
      makeItem({
        item_id: "e",
        display_name: "Anderer Laden",
        deferred_reason: "elsewhere",
        buy_elsewhere_retailer: "EDEKA",
        is_deferred: true,
      }),
    ];

    const out = formatListAsText(unchecked, checked, deferred, {
      includeChecked: true,
      grouped: false,
      locale: "de",
    });

    expect(out).toMatch(/^- Oben/);
    expect(out).toContain("--- Später ---");
    expect(out).toContain("- Später kaufen");
    expect(out).toContain("--- EDEKA ---");
    expect(out).toContain("- Anderer Laden");
    expect(out).toContain("--- Erledigt ---");
    expect(out).toContain("- Abgehakt");
  });

  test("flat mode skips category headers", () => {
    const unchecked = [
      makeItem({ item_id: "1", display_name: "A", category_name: "CatA" }),
      makeItem({ item_id: "2", display_name: "B", category_name: "CatB" }),
    ];
    const out = formatListAsText(unchecked, [], [], { grouped: false });
    expect(out).not.toContain("CatA");
    expect(out).not.toContain("CatB");
    expect(out).toBe("- A\n- B");
  });

  test("excludes deferred when includeDeferred is false", () => {
    const deferred = [
      makeItem({ display_name: "Later", deferred_reason: "manual", is_deferred: true }),
    ];
    expect(formatListAsText([], [], deferred, { includeDeferred: false, locale: "de" })).toBe(
      "(Leere Liste)",
    );
  });
});
