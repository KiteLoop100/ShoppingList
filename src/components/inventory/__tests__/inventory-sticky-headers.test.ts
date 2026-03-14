import { describe, test, expect } from "vitest";
import { readFileSync } from "fs";
import { resolve } from "path";

const src = readFileSync(
  resolve(__dirname, "../inventory-list.tsx"),
  "utf-8",
);

describe("inventory-list sticky header wiring", () => {
  test("toolbar has sticky top-0 positioning", () => {
    expect(src).toContain('ref={toolbarRef}');
    expect(src).toContain("sticky top-0 z-10");
  });

  test("category headers reference --inv-header-h CSS variable", () => {
    expect(src).toContain("sticky top-[var(--inv-header-h,140px)]");
  });

  test("container has ref for CSS variable injection", () => {
    expect(src).toContain("ref={containerRef}");
  });

  test("ResizeObserver sets --inv-header-h on container", () => {
    expect(src).toContain('setProperty(\n        "--inv-header-h"');
    expect(src).toContain("new ResizeObserver(update)");
  });

  test("category headers z-index is between toolbar (z-10) and content", () => {
    expect(src).toMatch(/sticky top-\[var\(--inv-header-h.*\]\s+z-\[5\]/);
  });
});
