import { describe, it, expect } from "vitest";
import {
  normalizeProductName,
  resolveImageUrl,
  extractDemandGroupCode,
  isPrivateLabel,
} from "../import-helpers";

describe("normalizeProductName", () => {
  it("lowercases and replaces umlauts", () => {
    expect(normalizeProductName("Räucherlachs 200g")).toBe("raeucherlachs 200g");
    expect(normalizeProductName("Müsli Öko")).toBe("muesli oeko");
    expect(normalizeProductName("Süßwaren")).toBe("suesswaren");
  });

  it("removes non-alphanumeric chars except spaces", () => {
    expect(normalizeProductName("Bio-Mozzarella (125g)")).toBe("biomozzarella 125g");
  });

  it("trims whitespace", () => {
    expect(normalizeProductName("  Milch  ")).toBe("milch");
  });
});

describe("resolveImageUrl", () => {
  it("returns null for null/undefined/empty", () => {
    expect(resolveImageUrl(null)).toBeNull();
    expect(resolveImageUrl(undefined)).toBeNull();
    expect(resolveImageUrl("")).toBeNull();
    expect(resolveImageUrl("   ")).toBeNull();
  });

  it("resolves template URLs with {width} and {slug}", () => {
    const template =
      "https://dm.emea.cms.aldi.cx/is/image/aldiprodeu/product/jpg/scaleWidth/{width}/abc123/{slug}";
    const result = resolveImageUrl(template);
    expect(result).toBe(
      "https://dm.emea.cms.aldi.cx/is/image/aldiprodeu/product/jpg/scaleWidth/200/abc123/200",
    );
  });

  it("resolves template URLs with custom size", () => {
    const template =
      "https://dm.emea.cms.aldi.cx/is/image/aldiprodeu/product/jpg/scaleWidth/{width}/abc123/{slug}";
    const result = resolveImageUrl(template, "400");
    expect(result).toBe(
      "https://dm.emea.cms.aldi.cx/is/image/aldiprodeu/product/jpg/scaleWidth/400/abc123/400",
    );
  });

  it("replaces direct 1000px URLs with thumbnail size", () => {
    const direct =
      "https://dm.emea.cms.aldi.cx/is/image/aldiprodeu/product/jpg/scaleWidth/1000/969209ed-7891-48f5-8c0b-536808c86334/1000";
    const result = resolveImageUrl(direct);
    expect(result).toBe(
      "https://dm.emea.cms.aldi.cx/is/image/aldiprodeu/product/jpg/scaleWidth/200/969209ed-7891-48f5-8c0b-536808c86334/200",
    );
  });

  it("trims whitespace from URLs", () => {
    const url =
      "https://dm.emea.cms.aldi.cx/is/image/aldiprodeu/product/jpg/scaleWidth/{width}/x/{slug} ";
    const result = resolveImageUrl(url);
    expect(result).toBe(
      "https://dm.emea.cms.aldi.cx/is/image/aldiprodeu/product/jpg/scaleWidth/200/x/200",
    );
  });
});

describe("extractDemandGroupCode", () => {
  it("extracts numeric codes", () => {
    expect(extractDemandGroupCode("71-Gekühlter verzehrfertiger Fisch")).toBe("71");
    expect(extractDemandGroupCode("83-Milch/Sahne/Butter")).toBe("83");
    expect(extractDemandGroupCode("05-Chilled Convenience")).toBe("05");
  });

  it("extracts AK code", () => {
    expect(extractDemandGroupCode("AK-Aktionsartikel")).toBe("AK");
  });

  it("returns null for invalid formats", () => {
    expect(extractDemandGroupCode("")).toBeNull();
    expect(extractDemandGroupCode("no-dash-number")).toBeNull();
    expect(extractDemandGroupCode("Milchprodukte")).toBeNull();
  });
});

describe("isPrivateLabel", () => {
  it("returns true for 'Private Label'", () => {
    expect(isPrivateLabel("Private Label")).toBe(true);
  });

  it("returns false for 'Brand'", () => {
    expect(isPrivateLabel("Brand")).toBe(false);
  });

  it("returns false for null/undefined", () => {
    expect(isPrivateLabel(null)).toBe(false);
    expect(isPrivateLabel(undefined)).toBe(false);
  });
});
