import { describe, test, expect } from "vitest";
import { looksLikeRegisteredAccountUser } from "../session-guards";

describe("looksLikeRegisteredAccountUser", () => {
  test("returns true for email user that is not anonymous", () => {
    expect(looksLikeRegisteredAccountUser({ email: "a@b.com", is_anonymous: false })).toBe(true);
  });

  test("returns false for anonymous user even if email field is set", () => {
    expect(looksLikeRegisteredAccountUser({ email: "x@y.com", is_anonymous: true })).toBe(false);
  });

  test("returns false when no email", () => {
    expect(looksLikeRegisteredAccountUser({ email: null, is_anonymous: false })).toBe(false);
    expect(looksLikeRegisteredAccountUser({ email: undefined, is_anonymous: undefined })).toBe(false);
  });

  test("treats missing is_anonymous with email as registered", () => {
    expect(looksLikeRegisteredAccountUser({ email: "a@b.com", is_anonymous: undefined })).toBe(true);
  });
});
