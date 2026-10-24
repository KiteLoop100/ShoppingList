import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("@/lib/utils/logger", () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

import { fetchAndPreprocessImage } from "../image-utils";

const mockFetch = vi.fn();

function response(body: ArrayBuffer, contentType: string, ok = true, status = 200) {
  return {
    ok,
    status,
    arrayBuffer: () => Promise.resolve(body),
    headers: new Headers({ "content-type": contentType }),
  };
}

describe("fetchAndPreprocessImage – fetch behaviour", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('fetches with redirect: "error" so a redirect can never leave the validated host', async () => {
    mockFetch.mockResolvedValue(response(new ArrayBuffer(4), "application/pdf"));
    await fetchAndPreprocessImage("https://proj.supabase.co/storage/v1/object/public/a.pdf");
    expect(mockFetch).toHaveBeenCalledWith(
      "https://proj.supabase.co/storage/v1/object/public/a.pdf",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("propagates the failure when fetch rejects because of a redirect", async () => {
    mockFetch.mockRejectedValue(new TypeError("fetch failed"));
    await expect(
      fetchAndPreprocessImage("https://proj.supabase.co/storage/v1/object/public/a.jpg"),
    ).rejects.toThrow("fetch failed");
  });

  it("throws on a non-OK response", async () => {
    mockFetch.mockResolvedValue(response(new ArrayBuffer(0), "image/jpeg", false, 404));
    await expect(
      fetchAndPreprocessImage("https://proj.supabase.co/storage/v1/object/public/a.jpg"),
    ).rejects.toThrow("Fetch: 404");
  });

  it("returns PDF payload untouched when the content type is application/pdf", async () => {
    const buf = new Uint8Array([1, 2, 3]).buffer;
    mockFetch.mockResolvedValue(response(buf, "application/pdf"));
    const out = await fetchAndPreprocessImage("https://proj.supabase.co/storage/v1/object/public/a.pdf");
    expect(out.isPdf).toBe(true);
    expect(out.pdfBuf).toBe(buf);
  });
});
