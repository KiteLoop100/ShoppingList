import {
  buildDemandGroupsAndSubGroupsPrompt,
  buildDemandGroupListPrompt,
  type DemandGroupEntry,
  type DemandSubGroupEntry,
} from "../constants";

const sampleGroups: DemandGroupEntry[] = [
  { code: "83", name: "Milch/Sahne/Butter", name_en: "Dairy" },
  { code: "38", name: "Gemüse", name_en: "Vegetables" },
  { code: "58", name: "Obst", name_en: "Fruit" },
];

const sampleSubGroups: DemandSubGroupEntry[] = [
  { code: "83-01", name: "Milchgetränke", name_en: "Milk Drinks", demand_group_code: "83" },
  { code: "83-02", name: "Milch", name_en: "Milk", demand_group_code: "83" },
  { code: "83-03", name: "Sahne", name_en: "Cream", demand_group_code: "83" },
  { code: "38-01", name: "Frischgemüse", name_en: "Fresh Vegetables", demand_group_code: "38" },
  { code: "38-02", name: "Tiefkühlgemüse", name_en: "Frozen Vegetables", demand_group_code: "38" },
];

describe("buildDemandGroupsAndSubGroupsPrompt", () => {
  test("produces structured output with groups and sub-groups", () => {
    const result = buildDemandGroupsAndSubGroupsPrompt(sampleGroups, sampleSubGroups);

    expect(result).toContain("Demand Group 83 (Milch/Sahne/Butter):");
    expect(result).toContain("83-01 Milchgetränke");
    expect(result).toContain("83-02 Milch");
    expect(result).toContain("83-03 Sahne");
    expect(result).toContain("Demand Group 38 (Gemüse):");
    expect(result).toContain("38-01 Frischgemüse");
  });

  test("shows '(keine Sub-Groups)' when a group has no sub-groups", () => {
    const result = buildDemandGroupsAndSubGroupsPrompt(sampleGroups, sampleSubGroups);
    expect(result).toContain("Demand Group 58 (Obst):");
    expect(result).toContain("(keine Sub-Groups)");
  });

  test("handles empty sub-groups array", () => {
    const result = buildDemandGroupsAndSubGroupsPrompt(sampleGroups, []);
    expect(result).toContain("Demand Group 83 (Milch/Sahne/Butter):");
    expect(result).toContain("(keine Sub-Groups)");
  });

  test("handles empty groups array", () => {
    const result = buildDemandGroupsAndSubGroupsPrompt([], sampleSubGroups);
    expect(result).not.toContain("Demand Group");
    expect(result).toContain("Ordne jedes Produkt");
  });

  test("groups are listed in input order", () => {
    const result = buildDemandGroupsAndSubGroupsPrompt(sampleGroups, sampleSubGroups);
    const idx83 = result.indexOf("Demand Group 83");
    const idx38 = result.indexOf("Demand Group 38");
    const idx58 = result.indexOf("Demand Group 58");
    expect(idx83).toBeLessThan(idx38);
    expect(idx38).toBeLessThan(idx58);
  });

  test("sub-groups are listed within their parent group", () => {
    const result = buildDemandGroupsAndSubGroupsPrompt(sampleGroups, sampleSubGroups);
    const group83Start = result.indexOf("Demand Group 83");
    const group38Start = result.indexOf("Demand Group 38");
    const sub8301 = result.indexOf("83-01 Milchgetränke");
    expect(sub8301).toBeGreaterThan(group83Start);
    expect(sub8301).toBeLessThan(group38Start);
  });
});

describe("buildDemandGroupListPrompt", () => {
  test("produces flat list with code and name", () => {
    const result = buildDemandGroupListPrompt(sampleGroups);
    expect(result).toContain("- 83: Milch/Sahne/Butter");
    expect(result).toContain("- 38: Gemüse");
    expect(result).toContain("- 58: Obst");
  });

  test("handles empty groups", () => {
    expect(buildDemandGroupListPrompt([])).toBe("");
  });

  test("one line per group", () => {
    const result = buildDemandGroupListPrompt(sampleGroups);
    const lines = result.split("\n").filter((l) => l.trim());
    expect(lines).toHaveLength(3);
  });
});
