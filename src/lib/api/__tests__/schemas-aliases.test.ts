import { createManualSchema } from "../schemas";

describe("createManualSchema – aliases field", () => {
  const base = { name: "Testprodukt" };

  test("accepts valid aliases array", () => {
    const result = createManualSchema.safeParse({
      ...base,
      aliases: ["Hafermilch", "Oat Milk"],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aliases).toEqual(["Hafermilch", "Oat Milk"]);
    }
  });

  test("defaults to empty array when aliases not provided", () => {
    const result = createManualSchema.safeParse(base);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aliases).toEqual([]);
    }
  });

  test("trims whitespace from alias strings", () => {
    const result = createManualSchema.safeParse({
      ...base,
      aliases: ["  Hafermilch  ", "  Oat Milk  "],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aliases).toEqual(["Hafermilch", "Oat Milk"]);
    }
  });

  test("rejects more than 20 aliases", () => {
    const tooMany = Array.from({ length: 21 }, (_, i) => `Alias ${i}`);
    const result = createManualSchema.safeParse({
      ...base,
      aliases: tooMany,
    });
    expect(result.success).toBe(false);
  });

  test("rejects alias strings longer than 100 characters", () => {
    const result = createManualSchema.safeParse({
      ...base,
      aliases: ["x".repeat(101)],
    });
    expect(result.success).toBe(false);
  });

  test("accepts empty aliases array", () => {
    const result = createManualSchema.safeParse({
      ...base,
      aliases: [],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.aliases).toEqual([]);
    }
  });
});
