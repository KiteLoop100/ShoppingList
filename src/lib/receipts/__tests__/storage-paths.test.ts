import { describe, it, expect } from "vitest";
import { isOwnStoragePath, findForeignStoragePath } from "../storage-paths";

const USER = "11111111-2222-3333-4444-555555555555";

describe("isOwnStoragePath", () => {
  it("accepts paths inside the user's folder", () => {
    expect(isOwnStoragePath(`${USER}/1700000000_0.jpg`, USER)).toBe(true);
    expect(isOwnStoragePath(`${USER}/sub/dir/file.jpg`, USER)).toBe(true);
  });

  it("rejects another user's folder and prefix look-alikes", () => {
    expect(isOwnStoragePath("other-user/1700000000_0.jpg", USER)).toBe(false);
    expect(isOwnStoragePath(`${USER}x/file.jpg`, USER)).toBe(false);
    expect(isOwnStoragePath(USER, USER)).toBe(false); // bare folder, no object
  });

  it("rejects traversal, empty segments and empty user id", () => {
    expect(isOwnStoragePath(`${USER}/../other/file.jpg`, USER)).toBe(false);
    expect(isOwnStoragePath(`${USER}/./file.jpg`, USER)).toBe(false);
    expect(isOwnStoragePath(`${USER}//file.jpg`, USER)).toBe(false);
    expect(isOwnStoragePath(`${USER}/`, USER)).toBe(false);
    expect(isOwnStoragePath("/file.jpg", "")).toBe(false);
  });
});

describe("findForeignStoragePath", () => {
  it("returns null when all paths are owned, else the first offender", () => {
    expect(findForeignStoragePath([`${USER}/a.jpg`, `${USER}/b.jpg`], USER)).toBeNull();
    expect(findForeignStoragePath([], USER)).toBeNull();
    expect(findForeignStoragePath([`${USER}/a.jpg`, "victim/b.jpg"], USER)).toBe("victim/b.jpg");
  });
});
