import { describe, test, expect } from "vitest";
import { filterNewFiles, type ProcessedEntry } from "../flyer-import-helpers";

function entry(flyerId: string): ProcessedEntry {
  return { flyerId, processedAt: "2026-03-01T12:00:00.000Z" };
}

describe("filterNewFiles", () => {
  const allFiles = ["flyer-a.pdf", "flyer-b.pdf", "flyer-c.pdf"];

  test("skips already-processed files", () => {
    const processed = { "flyer-a.pdf": entry("id-a"), "flyer-c.pdf": entry("id-c") };
    const { files, skipped } = filterNewFiles(allFiles, processed, {});
    expect(files).toEqual(["flyer-b.pdf"]);
    expect(skipped).toEqual(["flyer-a.pdf", "flyer-c.pdf"]);
  });

  test("returns all files when none are processed", () => {
    const { files, skipped } = filterNewFiles(allFiles, {}, {});
    expect(files).toEqual(allFiles);
    expect(skipped).toEqual([]);
  });

  test("returns no files when all are processed", () => {
    const processed = {
      "flyer-a.pdf": entry("id-a"),
      "flyer-b.pdf": entry("id-b"),
      "flyer-c.pdf": entry("id-c"),
    };
    const { files, skipped } = filterNewFiles(allFiles, processed, {});
    expect(files).toEqual([]);
    expect(skipped).toEqual(allFiles);
  });

  test("--force bypasses filtering and returns all files", () => {
    const processed = { "flyer-a.pdf": entry("id-a"), "flyer-b.pdf": entry("id-b") };
    const { files, skipped } = filterNewFiles(allFiles, processed, { force: true });
    expect(files).toEqual(allFiles);
    expect(skipped).toEqual([]);
  });

  test("--dry-run bypasses filtering and returns all files", () => {
    const processed = { "flyer-a.pdf": entry("id-a") };
    const { files, skipped } = filterNewFiles(allFiles, processed, { dryRun: true });
    expect(files).toEqual(allFiles);
    expect(skipped).toEqual([]);
  });

  test("ignores processed entries for files not in allFiles", () => {
    const processed = { "old-flyer.pdf": entry("id-old") };
    const { files, skipped } = filterNewFiles(allFiles, processed, {});
    expect(files).toEqual(allFiles);
    expect(skipped).toEqual([]);
  });

  test("handles empty allFiles list", () => {
    const { files, skipped } = filterNewFiles([], { "x.pdf": entry("id-x") }, {});
    expect(files).toEqual([]);
    expect(skipped).toEqual([]);
  });
});
