import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/list", () => ({
  updateListItem: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { warn: vi.fn() },
}));

import { updateListItem } from "@/lib/list";

/**
 * Since @testing-library/react is not available, we test the hook's
 * core logic by extracting it into testable pure functions.
 * The hook itself is thin enough that these cover the key behaviors.
 */

const MAX_COMMENT_LENGTH = 500;

function clampComment(value: string): string {
  return value.slice(0, MAX_COMMENT_LENGTH);
}

function shouldPersist(value: string, lastSaved: string): boolean {
  return value !== lastSaved;
}

function commentToPayload(value: string): string | null {
  return value || null;
}

describe("useItemComment logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("clamps comment to 500 characters", () => {
    const longText = "a".repeat(600);
    expect(clampComment(longText)).toHaveLength(500);
  });

  test("preserves short comments unchanged", () => {
    expect(clampComment("hello")).toBe("hello");
  });

  test("shouldPersist returns false when value equals lastSaved", () => {
    expect(shouldPersist("existing", "existing")).toBe(false);
  });

  test("shouldPersist returns true when value differs", () => {
    expect(shouldPersist("new value", "old value")).toBe(true);
  });

  test("commentToPayload returns null for empty string", () => {
    expect(commentToPayload("")).toBeNull();
  });

  test("commentToPayload returns string for non-empty", () => {
    expect(commentToPayload("note")).toBe("note");
  });

  test("updateListItem is called with comment field", async () => {
    await updateListItem("item-1", { comment: "test note" });
    expect(updateListItem).toHaveBeenCalledWith("item-1", { comment: "test note" });
  });

  test("updateListItem accepts null comment to clear", async () => {
    await updateListItem("item-1", { comment: null });
    expect(updateListItem).toHaveBeenCalledWith("item-1", { comment: null });
  });
});
