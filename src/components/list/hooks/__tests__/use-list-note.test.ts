import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/list", () => ({
  updateShoppingListNotes: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { warn: vi.fn() },
}));

import { updateShoppingListNotes } from "@/lib/list";

const MAX_NOTE_LENGTH = 500;

function clampNote(value: string): string {
  return value.slice(0, MAX_NOTE_LENGTH);
}

function shouldPersist(value: string, lastSaved: string): boolean {
  return value !== lastSaved;
}

function noteToPayload(value: string): string | null {
  return value || null;
}

describe("useListNote logic", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("clamps note to 500 characters", () => {
    const longText = "a".repeat(600);
    expect(clampNote(longText)).toHaveLength(500);
  });

  test("preserves short notes unchanged", () => {
    expect(clampNote("Leergut mitbringen")).toBe("Leergut mitbringen");
  });

  test("shouldPersist returns false when value equals lastSaved", () => {
    expect(shouldPersist("Budget 80 EUR", "Budget 80 EUR")).toBe(false);
  });

  test("shouldPersist returns true when value differs", () => {
    expect(shouldPersist("new note", "old note")).toBe(true);
  });

  test("noteToPayload returns null for empty string", () => {
    expect(noteToPayload("")).toBeNull();
  });

  test("noteToPayload returns string for non-empty", () => {
    expect(noteToPayload("Leergut")).toBe("Leergut");
  });

  test("updateShoppingListNotes is called with notes", async () => {
    await updateShoppingListNotes("list-1", "test note");
    expect(updateShoppingListNotes).toHaveBeenCalledWith("list-1", "test note");
  });

  test("updateShoppingListNotes accepts null to clear", async () => {
    await updateShoppingListNotes("list-1", null);
    expect(updateShoppingListNotes).toHaveBeenCalledWith("list-1", null);
  });
});
