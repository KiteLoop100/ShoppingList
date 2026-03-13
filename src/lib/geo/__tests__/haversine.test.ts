import { describe, test, expect } from "vitest";
import { distanceMeters, geoBoundingBox } from "@/lib/geo/haversine";

describe("distanceMeters", () => {
  test("returns 0 for identical points", () => {
    expect(distanceMeters(48.137, 11.576, 48.137, 11.576)).toBeCloseTo(0, 1);
  });

  test("returns ~111m for 0.001 degree latitude difference", () => {
    const d = distanceMeters(48.137, 11.576, 48.138, 11.576);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });

  test("handles antipodal points (max distance ~20000km)", () => {
    const d = distanceMeters(0, 0, 0, 180);
    expect(d).toBeGreaterThan(20_000_000);
    expect(d).toBeLessThan(20_100_000);
  });

  test("handles negative coordinates", () => {
    const d = distanceMeters(-36.848, 174.763, -36.849, 174.763);
    expect(d).toBeGreaterThan(100);
    expect(d).toBeLessThan(120);
  });
});

describe("geoBoundingBox", () => {
  test("returns symmetric box around center", () => {
    const box = geoBoundingBox(48.0, 11.0, 1000);
    expect(box.latMin).toBeLessThan(48.0);
    expect(box.latMax).toBeGreaterThan(48.0);
    expect(box.lonMin).toBeLessThan(11.0);
    expect(box.lonMax).toBeGreaterThan(11.0);
    expect(box.latMax - box.latMin).toBeCloseTo(box.latMax - 48.0 + 48.0 - box.latMin, 5);
  });

  test("larger radius produces wider box", () => {
    const small = geoBoundingBox(48.0, 11.0, 100);
    const large = geoBoundingBox(48.0, 11.0, 10_000);
    expect(large.latMax - large.latMin).toBeGreaterThan(small.latMax - small.latMin);
    expect(large.lonMax - large.lonMin).toBeGreaterThan(small.lonMax - small.lonMin);
  });

  test("box contains center point", () => {
    const box = geoBoundingBox(48.137, 11.576, 500);
    expect(48.137).toBeGreaterThan(box.latMin);
    expect(48.137).toBeLessThan(box.latMax);
    expect(11.576).toBeGreaterThan(box.lonMin);
    expect(11.576).toBeLessThan(box.lonMax);
  });
});
