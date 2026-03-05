import { describe, test, expect } from "vitest";
import { matchBboxesToProducts } from "../flyer-import-helpers";

type Bbox = [number, number, number, number];

function box(label: string, bbox: Bbox) {
  return { label, bbox };
}

describe("matchBboxesToProducts", () => {
  test("matches exact labels case-insensitively", () => {
    const boxes = [
      box("Milch 3,5%", [100, 200, 300, 400]),
      box("Bananen", [500, 600, 700, 800]),
    ];
    const result = matchBboxesToProducts(boxes, ["Milch 3,5%", "Bananen"]);
    expect(result.size).toBe(2);
    expect(result.get("Milch 3,5%")).toEqual([100, 200, 300, 400]);
    expect(result.get("Bananen")).toEqual([500, 600, 700, 800]);
  });

  test("matches when label is substring of product name", () => {
    const boxes = [box("Vollmilch", [10, 20, 30, 40])];
    const result = matchBboxesToProducts(boxes, ["Milsani Vollmilch 3,5%"]);
    expect(result.size).toBe(1);
    expect(result.get("Milsani Vollmilch 3,5%")).toEqual([10, 20, 30, 40]);
  });

  test("matches when product name is substring of label", () => {
    const boxes = [box("Bio Bananen Fair Trade", [10, 20, 30, 40])];
    const result = matchBboxesToProducts(boxes, ["Bio Bananen"]);
    expect(result.size).toBe(1);
    expect(result.get("Bio Bananen")).toEqual([10, 20, 30, 40]);
  });

  test("matches by word overlap", () => {
    const boxes = [box("Frische Vollmilch Alpenmilch", [10, 20, 30, 40])];
    const result = matchBboxesToProducts(boxes, ["Alpenmilch frisch"]);
    expect(result.size).toBe(1);
  });

  test("returns empty map when no boxes provided", () => {
    const result = matchBboxesToProducts([], ["Milch"]);
    expect(result.size).toBe(0);
  });

  test("returns empty map when no product names provided", () => {
    const boxes = [box("Milch", [10, 20, 30, 40])];
    const result = matchBboxesToProducts(boxes, []);
    expect(result.size).toBe(0);
  });

  test("each box is used only once", () => {
    const boxes = [box("Butter", [10, 20, 30, 40])];
    const result = matchBboxesToProducts(boxes, ["Butter", "Irische Butter"]);
    expect(result.size).toBe(1);
    expect(result.has("Butter")).toBe(true);
  });

  test("does not match when score is below threshold", () => {
    const boxes = [box("Waschmaschine XL Pro", [10, 20, 30, 40])];
    const result = matchBboxesToProducts(boxes, ["Milch"]);
    expect(result.size).toBe(0);
  });

  test("handles German umlauts and sharp s", () => {
    const boxes = [box("Müsli Nüsse", [10, 20, 30, 40])];
    const result = matchBboxesToProducts(boxes, ["Müsli Nüsse"]);
    expect(result.size).toBe(1);
    expect(result.get("Müsli Nüsse")).toEqual([10, 20, 30, 40]);
  });

  test("handles mixed case matching", () => {
    const boxes = [box("HÄHNCHENBRUST", [10, 20, 30, 40])];
    const result = matchBboxesToProducts(boxes, ["Hähnchenbrust"]);
    expect(result.size).toBe(1);
  });

  test("matches multiple products to different boxes", () => {
    const boxes = [
      box("Gouda jung", [0, 0, 100, 100]),
      box("Emmentaler", [100, 0, 200, 100]),
      box("Mozzarella", [200, 0, 300, 100]),
    ];
    const result = matchBboxesToProducts(
      boxes,
      ["Gouda jung geschnitten", "Emmentaler am Stück", "Mozzarella Kugeln"],
    );
    expect(result.size).toBe(3);
  });

  test("prefers exact match over partial match", () => {
    const boxes = [
      box("Butter", [0, 0, 100, 100]),
      box("Irische Butter", [100, 0, 200, 100]),
    ];
    const result = matchBboxesToProducts(boxes, ["Butter", "Irische Butter"]);
    expect(result.size).toBe(2);
    expect(result.get("Butter")).toEqual([0, 0, 100, 100]);
    expect(result.get("Irische Butter")).toEqual([100, 0, 200, 100]);
  });
});
