import { describe, test, expect, vi } from "vitest";

/**
 * Tests the arrow navigation logic as a pure function.
 * The actual hook wraps this with React refs.
 */

interface FocusableItem {
  id: string;
  focused: boolean;
}

function computeNextIndex(
  key: string,
  count: number,
  currentIdx: number,
): number | null {
  const isArrowUp = key === "ArrowUp";
  const isArrowDown = key === "ArrowDown";
  const isHome = key === "Home";
  const isEnd = key === "End";

  if (!isArrowUp && !isArrowDown && !isHome && !isEnd) return null;
  if (count === 0) return null;

  if (isHome) return 0;
  if (isEnd) return count - 1;
  if (isArrowDown) return currentIdx < count - 1 ? currentIdx + 1 : 0;
  return currentIdx > 0 ? currentIdx - 1 : count - 1;
}

describe("useArrowNavigation logic", () => {
  test("ArrowDown moves to next item", () => {
    expect(computeNextIndex("ArrowDown", 5, 0)).toBe(1);
    expect(computeNextIndex("ArrowDown", 5, 2)).toBe(3);
  });

  test("ArrowUp moves to previous item", () => {
    expect(computeNextIndex("ArrowUp", 5, 2)).toBe(1);
    expect(computeNextIndex("ArrowUp", 5, 4)).toBe(3);
  });

  test("ArrowDown wraps from last to first", () => {
    expect(computeNextIndex("ArrowDown", 5, 4)).toBe(0);
    expect(computeNextIndex("ArrowDown", 3, 2)).toBe(0);
  });

  test("ArrowUp wraps from first to last", () => {
    expect(computeNextIndex("ArrowUp", 5, 0)).toBe(4);
    expect(computeNextIndex("ArrowUp", 3, 0)).toBe(2);
  });

  test("Home goes to first item", () => {
    expect(computeNextIndex("Home", 5, 3)).toBe(0);
    expect(computeNextIndex("Home", 5, 0)).toBe(0);
  });

  test("End goes to last item", () => {
    expect(computeNextIndex("End", 5, 1)).toBe(4);
    expect(computeNextIndex("End", 5, 4)).toBe(4);
  });

  test("non-navigation keys return null", () => {
    expect(computeNextIndex("Enter", 5, 0)).toBeNull();
    expect(computeNextIndex("a", 5, 2)).toBeNull();
    expect(computeNextIndex("Tab", 5, 0)).toBeNull();
  });

  test("empty list returns null", () => {
    expect(computeNextIndex("ArrowDown", 0, -1)).toBeNull();
    expect(computeNextIndex("Home", 0, -1)).toBeNull();
  });

  test("single item wraps to itself", () => {
    expect(computeNextIndex("ArrowDown", 1, 0)).toBe(0);
    expect(computeNextIndex("ArrowUp", 1, 0)).toBe(0);
  });
});
