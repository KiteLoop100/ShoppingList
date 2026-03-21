import { describe, test, expect } from "vitest";
import { createManualSchema } from "../schemas";

describe("createManualSchema", () => {
  const base = { name: "Testprodukt" };

  test("accepts thumbnail_base64 longer than legacy 5M cap (aligns with capture client budget)", () => {
    const longB64 = "a".repeat(5_000_001);
    const result = createManualSchema.safeParse({
      ...base,
      thumbnail_base64: longB64,
    });
    expect(result.success).toBe(true);
  });

  test("accepts gallery image_base64 longer than legacy 5M cap", () => {
    const longB64 = "b".repeat(5_000_001);
    const result = createManualSchema.safeParse({
      ...base,
      gallery_photos: [{ image_base64: longB64, format: "image/webp", category: "product" }],
    });
    expect(result.success).toBe(true);
  });

  test("maps nutrition_info array to null via preprocess (invalid AI shape)", () => {
    const result = createManualSchema.safeParse({
      ...base,
      nutrition_info: [{ k: 1 }],
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.nutrition_info).toBeNull();
    }
  });
});
