import { describe, expect, test } from "vitest";
import { parseIngredientString } from "@/lib/recipe/ingredient-parser";

describe("parseIngredientString", () => {
  test("parses amount, unit, name (400 g Spaghetti)", () => {
    const r = parseIngredientString("400 g Spaghetti");
    expect(r).toMatchObject({
      name: "Spaghetti",
      amount: 400,
      unit: "g",
      category: "",
      is_optional: false,
    });
  });

  test("parses eggs with note and Stk", () => {
    const r = parseIngredientString("4 Eier (Größe M)");
    expect(r).toMatchObject({
      name: "Eier",
      amount: 4,
      unit: "Stk",
      notes: "Größe M",
    });
  });

  test("parses Prise", () => {
    const r = parseIngredientString("1 Prise Salz");
    expect(r).toMatchObject({
      name: "Salz",
      amount: 1,
      unit: "Prise",
    });
  });

  test("parses etwas Olivenöl", () => {
    const r = parseIngredientString("etwas Olivenöl");
    expect(r).toMatchObject({
      name: "Olivenöl",
      amount: null,
      unit: null,
      notes: "etwas",
    });
  });

  test("parses half Bund Petersilie", () => {
    const r = parseIngredientString("1/2 Bund glatte Petersilie");
    expect(r).toMatchObject({
      name: "glatte Petersilie",
      amount: 0.5,
      unit: "Bund",
    });
  });

  test("parses Salz und Pfeffer as name only", () => {
    const r = parseIngredientString("Salz und Pfeffer");
    expect(r).toMatchObject({
      name: "Salz und Pfeffer",
      amount: null,
      unit: null,
    });
  });

  test("parses Sahne with parenthetical note", () => {
    const r = parseIngredientString("200 ml Sahne (alternativ: Crème fraîche)");
    expect(r).toMatchObject({
      name: "Sahne",
      amount: 200,
      unit: "ml",
      notes: "alternativ: Crème fraîche",
    });
  });

  test("parses Dose with nested weight note", () => {
    const r = parseIngredientString("1 Dose Tomaten (400 g)");
    expect(r).toMatchObject({
      name: "Tomaten",
      amount: 1,
      unit: "Dose",
      notes: "400 g",
    });
  });

  test("parses range Knoblauchzehen", () => {
    const r = parseIngredientString("2-3 Knoblauchzehen");
    expect(r).toMatchObject({
      name: "Knoblauchzehen",
      amount: 2.5,
      unit: "Stk",
      notes: "2-3",
    });
  });

  test("parses n. B. optional", () => {
    const r = parseIngredientString("n. B. Petersilie");
    expect(r).toMatchObject({
      name: "Petersilie",
      amount: null,
      is_optional: true,
    });
  });

  test("parses optional prefix", () => {
    const r = parseIngredientString("optional: Schnittlauch");
    expect(r).toMatchObject({
      name: "Schnittlauch",
      is_optional: true,
    });
  });
});
