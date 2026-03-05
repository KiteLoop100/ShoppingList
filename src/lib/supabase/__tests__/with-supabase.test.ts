import { vi, describe, test, expect, beforeEach } from "vitest";

const mockClient = { from: vi.fn() };
const mockCreateClient = vi.fn<[], ReturnType<typeof import("../client").createClientIfConfigured>>();

vi.mock("../client", () => ({
  createClientIfConfigured: () => mockCreateClient(),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}));

import { withSupabase } from "../with-supabase";
import { log } from "@/lib/utils/logger";

describe("withSupabase", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("returns fallback when no Supabase client is available", async () => {
    mockCreateClient.mockReturnValue(null);

    const result = await withSupabase(
      (sb) => sb.from("products").select("*"),
      { fallback: [], context: "[test]" },
    );

    expect(result).toEqual([]);
  });

  test("returns data on successful query", async () => {
    mockCreateClient.mockReturnValue(mockClient as never);
    const products = [{ id: "1", name: "Milch" }];
    const fn = vi.fn().mockResolvedValue({ data: products, error: null });

    const result = await withSupabase(fn, { fallback: [], context: "[test]" });

    expect(result).toEqual(products);
    expect(fn).toHaveBeenCalledWith(mockClient);
  });

  test("returns fallback and logs warning on Supabase error", async () => {
    mockCreateClient.mockReturnValue(mockClient as never);
    const error = { message: "relation does not exist", details: "", hint: "", code: "42P01" };
    const fn = vi.fn().mockResolvedValue({ data: null, error });

    const result = await withSupabase(fn, { fallback: "default", context: "[products]" });

    expect(result).toBe("default");
    expect(log.warn).toHaveBeenCalledWith("[products] Supabase error:", "relation does not exist");
  });

  test("returns fallback and logs warning on unexpected exception", async () => {
    mockCreateClient.mockReturnValue(mockClient as never);
    const fn = vi.fn().mockRejectedValue(new Error("Network timeout"));

    const result = await withSupabase(fn, { fallback: 0, context: "[count]" });

    expect(result).toBe(0);
    expect(log.warn).toHaveBeenCalledWith("[count] unexpected error:", expect.any(Error));
  });

  test("returns fallback when data is null (no error)", async () => {
    mockCreateClient.mockReturnValue(mockClient as never);
    const fn = vi.fn().mockResolvedValue({ data: null, error: null });

    const result = await withSupabase(fn, { fallback: [], context: "[test]" });

    expect(result).toEqual([]);
  });
});
