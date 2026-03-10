import {
  getMetaCategories,
  getChildGroups,
  getChildGroupCodes,
  type DemandGroupRow,
} from "../category-service";

const mockRows: DemandGroupRow[] = [
  { code: "M01", name: "Obst & Gemüse", name_en: "Fruit & Vegetables", icon: "🥬", color: "#1DB954", sort_position: 1, parent_group: null, is_meta: true, source: "curated" },
  { code: "M02", name: "Brot & Backwaren", name_en: "Bread & Bakery", icon: "🍞", color: "#D4960F", sort_position: 2, parent_group: null, is_meta: true, source: "curated" },
  { code: "38", name: "Gemüse", name_en: "Vegetables", icon: "🥦", color: "#1DB954", sort_position: 17, parent_group: "M01", is_meta: false, source: "official" },
  { code: "58", name: "Obst", name_en: "Fruit", icon: "🍎", color: "#28A745", sort_position: 18, parent_group: "M01", is_meta: false, source: "official" },
  { code: "88", name: "Salate", name_en: "Salads", icon: "🥗", color: "#15A040", sort_position: 19, parent_group: "M01", is_meta: false, source: "official" },
  { code: "56", name: "Bake-Off", name_en: "Bake-Off", icon: "🥐", color: "#E8A817", sort_position: 38, parent_group: "M02", is_meta: false, source: "official" },
  { code: "57", name: "Brot/Kuchen", name_en: "Bread / Cake", icon: "🍞", color: "#D4960F", sort_position: 39, parent_group: "M02", is_meta: false, source: "official" },
];

describe("getMetaCategories", () => {
  test("returns only rows with is_meta=true", () => {
    const metas = getMetaCategories(mockRows);
    expect(metas).toHaveLength(2);
    expect(metas[0].code).toBe("M01");
    expect(metas[1].code).toBe("M02");
  });

  test("returns empty array for empty input", () => {
    expect(getMetaCategories([])).toHaveLength(0);
  });
});

describe("getChildGroups", () => {
  test("returns child groups for a meta-category", () => {
    const children = getChildGroups(mockRows, "M01");
    expect(children).toHaveLength(3);
    expect(children.map((c) => c.code)).toEqual(["38", "58", "88"]);
  });

  test("returns different children for different meta-category", () => {
    const children = getChildGroups(mockRows, "M02");
    expect(children).toHaveLength(2);
    expect(children.map((c) => c.code)).toEqual(["56", "57"]);
  });

  test("returns empty array for unknown meta-category", () => {
    expect(getChildGroups(mockRows, "M99")).toHaveLength(0);
  });
});

describe("getChildGroupCodes", () => {
  test("returns codes as string array", () => {
    const codes = getChildGroupCodes(mockRows, "M01");
    expect(codes).toEqual(["38", "58", "88"]);
  });

  test("returns empty array for unknown meta-category", () => {
    expect(getChildGroupCodes(mockRows, "M99")).toEqual([]);
  });
});
