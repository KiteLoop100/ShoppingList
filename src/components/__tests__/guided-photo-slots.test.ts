import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

/**
 * Structural regression tests for guided-photo-slots.tsx.
 *
 * The front-photo and price-tag file inputs must NOT have capture="environment"
 * so that mobile OS shows its native Camera/Gallery picker menu (matching the
 * behaviour of the "extra photos" slot).
 */

const source = readFileSync(
  resolve(__dirname, "../guided-photo-slots.tsx"),
  "utf-8",
);

function extractInputBlock(refName: string): string | null {
  const pattern = new RegExp(
    `<input\\s+ref=\\{${refName}\\}[^>]*/>`,
    "s",
  );
  const match = source.match(pattern);
  return match ? match[0] : null;
}

describe("GuidedPhotoSlots file inputs", () => {
  test("front-photo input exists and has no capture attribute", () => {
    const input = extractInputBlock("fileInputFrontRef");
    expect(input).toBeTruthy();
    expect(input).not.toContain("capture");
  });

  test("price-tag input exists and has no capture attribute", () => {
    const input = extractInputBlock("fileInputPriceRef");
    expect(input).toBeTruthy();
    expect(input).not.toContain("capture");
  });

  test("extra-photos input exists and has no capture attribute", () => {
    const input = extractInputBlock("fileInputExtraRef");
    expect(input).toBeTruthy();
    expect(input).not.toContain("capture");
  });

  test("all three inputs accept image/*", () => {
    for (const ref of ["fileInputFrontRef", "fileInputPriceRef", "fileInputExtraRef"]) {
      const input = extractInputBlock(ref);
      expect(input).toBeTruthy();
      expect(input).toContain('accept="image/*"');
    }
  });
});
