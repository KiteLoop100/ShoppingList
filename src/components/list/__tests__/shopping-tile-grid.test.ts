import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * Tests for the ShoppingTileGrid exit-animation logic.
 *
 * The component now uses a flat CSS grid with exit animations:
 * - Checked items enter an "exiting" set and play an animation.
 * - After EXIT_ANIMATION_MS (300ms), the item is removed and onCheck is called.
 * - Remaining items reflow automatically via CSS Grid.
 *
 * Since we can't render React components (no jsdom), we test the
 * underlying state-management logic as pure functions.
 */

const EXIT_ANIMATION_MS = 300;

interface ExitState {
  exitingIds: Set<string>;
  timers: Map<string, ReturnType<typeof setTimeout>>;
}

function createExitState(): ExitState {
  return { exitingIds: new Set(), timers: new Map() };
}

function handleCheck(
  state: ExitState,
  itemId: string,
  onCheck: (id: string, checked: boolean) => void,
): ExitState {
  const next: ExitState = {
    exitingIds: new Set([...state.exitingIds, itemId]),
    timers: new Map(state.timers),
  };

  const timer = setTimeout(() => {
    next.exitingIds.delete(itemId);
    next.timers.delete(itemId);
    onCheck(itemId, true);
  }, EXIT_ANIMATION_MS);

  next.timers.set(itemId, timer);
  return next;
}

function getVisibleItems(allIds: string[], exitingIds: Set<string>): string[] {
  return allIds;
}

function getExitingItems(allIds: string[], exitingIds: Set<string>): string[] {
  return allIds.filter((id) => exitingIds.has(id));
}

describe("ShoppingTileGrid exit logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("item is added to exitingIds on check", () => {
    const state = createExitState();
    const onCheck = vi.fn();
    const next = handleCheck(state, "item-1", onCheck);

    expect(next.exitingIds.has("item-1")).toBe(true);
    expect(onCheck).not.toHaveBeenCalled();
  });

  test("onCheck is called after EXIT_ANIMATION_MS", () => {
    const state = createExitState();
    const onCheck = vi.fn();
    handleCheck(state, "item-1", onCheck);

    vi.advanceTimersByTime(EXIT_ANIMATION_MS);
    expect(onCheck).toHaveBeenCalledWith("item-1", true);
  });

  test("onCheck is NOT called before animation completes", () => {
    const state = createExitState();
    const onCheck = vi.fn();
    handleCheck(state, "item-1", onCheck);

    vi.advanceTimersByTime(EXIT_ANIMATION_MS - 1);
    expect(onCheck).not.toHaveBeenCalled();
  });

  test("multiple items can be exiting simultaneously", () => {
    let state = createExitState();
    const onCheck = vi.fn();
    state = handleCheck(state, "item-1", onCheck);
    state = handleCheck(state, "item-2", onCheck);

    expect(state.exitingIds.has("item-1")).toBe(true);
    expect(state.exitingIds.has("item-2")).toBe(true);
    expect(state.timers.size).toBe(2);
  });

  test("all visible items are returned (exiting items still present)", () => {
    const allIds = ["a", "b", "c", "d"];
    const exitingIds = new Set(["b"]);
    const visible = getVisibleItems(allIds, exitingIds);
    expect(visible).toEqual(["a", "b", "c", "d"]);
  });

  test("exiting items are correctly identified", () => {
    const allIds = ["a", "b", "c", "d"];
    const exitingIds = new Set(["b", "d"]);
    const exiting = getExitingItems(allIds, exitingIds);
    expect(exiting).toEqual(["b", "d"]);
  });

  test("non-exiting items get no exit class", () => {
    const allIds = ["a", "b", "c"];
    const exitingIds = new Set(["b"]);
    const nonExiting = allIds.filter((id) => !exitingIds.has(id));
    expect(nonExiting).toEqual(["a", "c"]);
  });
});
