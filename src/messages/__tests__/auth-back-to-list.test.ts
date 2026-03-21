import { describe, expect, test } from "vitest";
import de from "../de.json";
import en from "../en.json";

describe("auth.backToShoppingList", () => {
  test("is defined in DE and EN for login navigation", () => {
    expect(de.auth.backToShoppingList).toMatch(/\S/);
    expect(en.auth.backToShoppingList).toMatch(/\S/);
  });
});
