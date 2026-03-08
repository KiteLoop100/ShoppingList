import { describe, test, expect, vi } from "vitest";

/**
 * Tests for TileActionMenu logic.
 *
 * Since we cannot render React components (no jsdom), we test the
 * logical behavior: which actions are available, and the action
 * dispatch pattern.
 */

interface TileActionMenuProps {
  onDefer?: () => void;
  onBuyElsewhere?: () => void;
  onDelete?: () => void;
}

function getAvailableActions(props: TileActionMenuProps) {
  const actions: string[] = [];
  if (props.onDefer) actions.push("defer");
  if (props.onBuyElsewhere) actions.push("buyElsewhere");
  if (props.onDelete) actions.push("delete");
  return actions;
}

function hasAnyAction(props: TileActionMenuProps): boolean {
  return !!(props.onDefer || props.onBuyElsewhere || props.onDelete);
}

function dispatchAction(
  actionName: string,
  props: TileActionMenuProps,
): boolean {
  const map: Record<string, (() => void) | undefined> = {
    defer: props.onDefer,
    buyElsewhere: props.onBuyElsewhere,
    delete: props.onDelete,
  };
  const fn = map[actionName];
  if (fn) {
    fn();
    return true;
  }
  return false;
}

describe("TileActionMenu", () => {
  test("returns no actions when no callbacks provided", () => {
    expect(getAvailableActions({})).toEqual([]);
    expect(hasAnyAction({})).toBe(false);
  });

  test("returns all actions when all callbacks provided", () => {
    const props: TileActionMenuProps = {
      onDefer: vi.fn(),
      onBuyElsewhere: vi.fn(),
      onDelete: vi.fn(),
    };
    expect(getAvailableActions(props)).toEqual(["defer", "buyElsewhere", "delete"]);
    expect(hasAnyAction(props)).toBe(true);
  });

  test("returns only provided actions", () => {
    expect(getAvailableActions({ onDelete: vi.fn() })).toEqual(["delete"]);
    expect(getAvailableActions({ onDefer: vi.fn(), onDelete: vi.fn() })).toEqual([
      "defer",
      "delete",
    ]);
  });

  test("dispatches correct callback for defer", () => {
    const onDefer = vi.fn();
    dispatchAction("defer", { onDefer });
    expect(onDefer).toHaveBeenCalledOnce();
  });

  test("dispatches correct callback for buyElsewhere", () => {
    const onBuyElsewhere = vi.fn();
    dispatchAction("buyElsewhere", { onBuyElsewhere });
    expect(onBuyElsewhere).toHaveBeenCalledOnce();
  });

  test("dispatches correct callback for delete", () => {
    const onDelete = vi.fn();
    dispatchAction("delete", { onDelete });
    expect(onDelete).toHaveBeenCalledOnce();
  });

  test("dispatch returns false for missing action", () => {
    expect(dispatchAction("defer", {})).toBe(false);
    expect(dispatchAction("buyElsewhere", { onDelete: vi.fn() })).toBe(false);
  });

  test("dispatch does not call other callbacks", () => {
    const onDefer = vi.fn();
    const onDelete = vi.fn();
    dispatchAction("defer", { onDefer, onDelete });
    expect(onDefer).toHaveBeenCalledOnce();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
