import { describe, expect, test } from "vitest";
import {
  extractFromJsonLd,
  parseIso8601DurationToMinutes,
  parseServingsFromYield,
} from "@/lib/recipe/extract";

describe("parseIso8601DurationToMinutes", () => {
  test("PT30M → 30", () => {
    expect(parseIso8601DurationToMinutes("PT30M")).toBe(30);
  });

  test("PT1H → 60", () => {
    expect(parseIso8601DurationToMinutes("PT1H")).toBe(60);
  });

  test("PT1H30M → 90", () => {
    expect(parseIso8601DurationToMinutes("PT1H30M")).toBe(90);
  });
});

describe("parseServingsFromYield", () => {
  test("parses number", () => {
    expect(parseServingsFromYield(4)).toEqual({ servings: 4, label: "Portionen" });
  });

  test("parses string with label", () => {
    const r = parseServingsFromYield("4 Portionen");
    expect(r.servings).toBe(4);
    expect(r.label.toLowerCase()).toContain("portionen");
  });
});

describe("extractFromJsonLd", () => {
  test("extracts Recipe from JSON-LD script", () => {
    const html = `
      <html><body>
      <script type="application/ld+json">
      {
        "@context": "https://schema.org",
        "@type": "Recipe",
        "name": "Test Pasta",
        "recipeYield": "2 Portionen",
        "prepTime": "PT15M",
        "cookTime": "PT20M",
        "recipeIngredient": ["400 g Nudeln", "1 EL Öl"]
      }
      </script>
      </body></html>
    `;
    const r = extractFromJsonLd(html);
    expect(r).not.toBeNull();
    expect(r!.title).toBe("Test Pasta");
    expect(r!.servings).toBe(2);
    expect(r!.ingredients).toHaveLength(2);
    expect(r!.ingredients[0].name).toMatch(/Nudeln/);
    expect(r!.prep_time_minutes).toBe(15);
    expect(r!.cook_time_minutes).toBe(20);
  });

  test("finds Recipe inside @graph", () => {
    const html = `
      <script type="application/ld+json">
      {"@graph":[{"@type":"Recipe","name":"Graph Rezept","recipeIngredient":["100 g Mehl"]}]}
      </script>
    `;
    const r = extractFromJsonLd(html);
    expect(r?.title).toBe("Graph Rezept");
    expect(r?.ingredients).toHaveLength(1);
  });
});
