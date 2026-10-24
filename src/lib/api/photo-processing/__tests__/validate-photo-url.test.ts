import { describe, it, expect } from "vitest";
import { validateStoragePhotoUrl } from "../validate-photo-url";

const SUPABASE = "https://abcd1234.supabase.co";
const GOOD = `${SUPABASE}/storage/v1/object/public/product-photos/user/photo.jpg`;

describe("validateStoragePhotoUrl", () => {
  it("accepts a public storage object of this project", () => {
    expect(validateStoragePhotoUrl(GOOD, SUPABASE).href).toBe(GOOD);
  });

  it("accepts a query string (cache busting)", () => {
    expect(() => validateStoragePhotoUrl(`${GOOD}?t=123`, SUPABASE)).not.toThrow();
  });

  it("rejects an arbitrary external host", () => {
    expect(() =>
      validateStoragePhotoUrl("https://example.com/storage/v1/object/public/a.jpg", SUPABASE),
    ).toThrow(/Supabase storage/);
  });

  it("rejects another Supabase project", () => {
    expect(() =>
      validateStoragePhotoUrl(
        "https://other.supabase.co/storage/v1/object/public/a.jpg",
        SUPABASE,
      ),
    ).toThrow(/Supabase storage/);
  });

  it("rejects look-alike hosts (suffix / prefix / userinfo tricks)", () => {
    for (const url of [
      "https://abcd1234.supabase.co.evil.com/storage/v1/object/public/a.jpg",
      "https://evil-abcd1234.supabase.co/storage/v1/object/public/a.jpg",
      "https://abcd1234.supabase.co@evil.com/storage/v1/object/public/a.jpg",
    ]) {
      expect(() => validateStoragePhotoUrl(url, SUPABASE), url).toThrow();
    }
  });

  it("rejects non-storage and non-public paths on our own host", () => {
    for (const path of [
      "/rest/v1/photo_uploads",
      "/auth/v1/user",
      "/storage/v1/object/authenticated/b/a.jpg",
      "/storage/v1/object/sign/b/a.jpg",
      "/storage/v1/object/public/../../../rest/v1/photo_uploads",
    ]) {
      expect(() => validateStoragePhotoUrl(`${SUPABASE}${path}`, SUPABASE), path).toThrow();
    }
  });

  it("rejects http, private IPs and localhost via validateExternalUrl", () => {
    expect(() =>
      validateStoragePhotoUrl(GOOD.replace("https:", "http:"), SUPABASE),
    ).toThrow(/https/);
    expect(() =>
      validateStoragePhotoUrl("https://169.254.169.254/latest/meta-data", SUPABASE),
    ).toThrow();
    expect(() =>
      validateStoragePhotoUrl("https://localhost/storage/v1/object/public/a.jpg", SUPABASE),
    ).toThrow();
  });

  it("rejects credentials embedded in the URL", () => {
    expect(() =>
      validateStoragePhotoUrl(
        "https://user:pw@abcd1234.supabase.co/storage/v1/object/public/a.jpg",
        SUPABASE,
      ),
    ).toThrow(/credentials/);
  });

  it("rejects everything when the Supabase URL is not configured", () => {
    expect(() => validateStoragePhotoUrl(GOOD, "")).toThrow(/not configured/);
  });
});
