import { describe, test, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();
const mockStorage = vi.fn();

vi.mock("@/lib/supabase/client", () => ({
  createClientIfConfigured: () => ({
    from: mockFrom,
    storage: { from: mockStorage },
  }),
}));

vi.mock("@/lib/utils/logger", () => ({
  log: { warn: vi.fn(), error: vi.fn() },
}));

import {
  getProductPhotos,
  addProductPhoto,
  deleteProductPhoto,
  setAsThumbnail,
  updatePhotoCategory,
} from "../product-photo-service";

function mockSelectChain(data: unknown[] | null, error: unknown = null) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        order: vi.fn().mockResolvedValue({ data, error }),
        single: vi.fn().mockResolvedValue({ data: data?.[0] ?? null, error }),
      }),
    }),
  };
}

function mockCountChain(count: number) {
  return {
    select: vi.fn().mockReturnValue({
      eq: vi.fn().mockResolvedValue({ count, error: null }),
    }),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getProductPhotos", () => {
  test("returns sorted photos", async () => {
    const photos = [
      { id: "1", category: "product", sort_order: 1, photo_url: "url1" },
      { id: "2", category: "thumbnail", sort_order: 0, photo_url: "url2" },
    ];
    mockFrom.mockReturnValue(mockSelectChain(photos));

    const result = await getProductPhotos("prod-1", "aldi");
    expect(result).toHaveLength(2);
    expect(result[0].category).toBe("thumbnail");
    expect(result[1].category).toBe("product");
  });

  test("returns empty array on error", async () => {
    mockFrom.mockReturnValue(mockSelectChain(null, { message: "DB error" }));

    const result = await getProductPhotos("prod-1", "aldi");
    expect(result).toEqual([]);
  });
});

describe("addProductPhoto", () => {
  test("throws on 5-photo limit", async () => {
    mockFrom.mockReturnValue(mockCountChain(5));

    const file = new File(["data"], "test.jpg", { type: "image/jpeg" });
    await expect(addProductPhoto("prod-1", "aldi", file, "product"))
      .rejects.toThrow("Maximal 5 Fotos pro Produkt erlaubt");
  });
});

describe("deleteProductPhoto", () => {
  test("skips storage delete for legacy buckets", async () => {
    const photo = {
      id: "photo-1",
      storage_bucket: "product-thumbnails",
      storage_path: "manual/test.jpg",
      category: "thumbnail",
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: photo, error: null }),
            }),
          }),
        };
      }
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    const result = await deleteProductPhoto("photo-1");
    expect(result).toBe(true);
    expect(mockStorage).not.toHaveBeenCalled();
  });

  test("deletes from storage for product-gallery bucket", async () => {
    const photo = {
      id: "photo-2",
      storage_bucket: "product-gallery",
      storage_path: "uuid.jpg",
      category: "product",
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: photo, error: null }),
            }),
          }),
        };
      }
      return {
        delete: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({ error: null }),
        }),
      };
    });

    mockStorage.mockReturnValue({
      remove: vi.fn().mockResolvedValue({ error: null }),
    });

    const result = await deleteProductPhoto("photo-2");
    expect(result).toBe(true);
    expect(mockStorage).toHaveBeenCalledWith("product-gallery");
  });
});

describe("setAsThumbnail", () => {
  test("rejects price_tag photos", async () => {
    const photo = {
      id: "photo-1",
      product_id: "prod-1",
      competitor_product_id: null,
      category: "price_tag",
    };

    mockFrom.mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue({ data: photo, error: null }),
        }),
      }),
    });

    const result = await setAsThumbnail("photo-1");
    expect(result).toBe(false);
  });
});

describe("updatePhotoCategory", () => {
  test("delegates to setAsThumbnail for thumbnail category", async () => {
    const photo = {
      id: "photo-1",
      product_id: "prod-1",
      competitor_product_id: null,
      category: "product",
    };

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      if (callCount === 1) {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: photo, error: null }),
            }),
          }),
        };
      }
      return {
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockResolvedValue({ error: null }),
          }),
        }),
      };
    });

    const result = await updatePhotoCategory("photo-1", "thumbnail");
    expect(mockFrom).toHaveBeenCalled();
  });

  test("updates category directly for product or price_tag", async () => {
    mockFrom.mockReturnValue({
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    });

    const result = await updatePhotoCategory("photo-1", "price_tag");
    expect(result).toBe(true);
  });
});
