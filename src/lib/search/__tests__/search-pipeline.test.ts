import { indexProducts } from "../search-indexer";
import { findCandidates } from "../candidate-retrieval";
import { scoreAndRank } from "../scoring-engine";
import { postProcess } from "../post-processor";
import type { Product } from "@/types";

// Minimal test products
const testProducts: Product[] = [
  {
    product_id: "1", name: "Rotwein Merlot 0,75l", name_normalized: "rotwein merlot 0,75l",
    brand: "VIALA", price: 3.99, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group: "03-Wein", popularity_score: 0.7,
  },
  {
    product_id: "2", name: "Weintrauben kernlos 500g", name_normalized: "weintrauben kernlos 500g",
    brand: null, price: 1.99, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group: "58-Obst", popularity_score: 0.6,
  },
  {
    product_id: "3", name: "Weißwein Chardonnay 1l", name_normalized: "weisswein chardonnay 1l",
    brand: "VIALA", price: 4.49, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group: "03-Wein", popularity_score: 0.65,
  },
  {
    product_id: "4", name: "Mineralwasser Classic 1,5l", name_normalized: "mineralwasser classic 1,5l",
    brand: "QUELLBRUNN", price: 0.49, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group: "05-Wasser", popularity_score: 0.9,
  },
  {
    product_id: "5", name: "Thunfisch in Wasser 195g", name_normalized: "thunfisch in wasser 195g",
    brand: "ALMARE", price: 1.29, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group: "82-Wurst-/Fleisch-/Fischkonserven", popularity_score: 0.5,
  },
  {
    product_id: "6", name: "KA: Batterien AA 8 Stk.", name_normalized: "ka: batterien aa 8 stk.",
    brand: "ACTIV ENERGY", price: 1.25, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group: "12-Audio/Video/Batterien", popularity_score: 0.3,
  },
] satisfies Product[];

const defaultPrefs = {
  exclude_gluten: false, exclude_lactose: false, exclude_nuts: false,
  prefer_cheapest: false, prefer_brand: false, prefer_bio: false,
  prefer_vegan: false, prefer_animal_welfare: false,
};

describe("Search Pipeline", () => {
  const indexed = indexProducts(testProducts);

  test("'wein' ranks Rotwein and Weißwein above Weintrauben", () => {
    const candidates = findCandidates("wein", indexed);
    const scored = scoreAndRank(candidates, 1, defaultPrefs, new Map());
    const result = postProcess(scored, defaultPrefs);
    const names = result.map((r) => r.product.search_name_normalized);

    // Rotwein and Weißwein should come before Weintrauben
    const rotweinIdx = names.findIndex((n) => n.includes("rotwein"));
    const weissweinIdx = names.findIndex((n) => n.includes("weisswein"));
    const weintraubenIdx = names.findIndex((n) => n.includes("weintrauben"));

    expect(rotweinIdx).toBeGreaterThanOrEqual(0);
    expect(weissweinIdx).toBeGreaterThanOrEqual(0);
    expect(weintraubenIdx).toBeGreaterThanOrEqual(0);
    expect(rotweinIdx).toBeLessThan(weintraubenIdx);
    expect(weissweinIdx).toBeLessThan(weintraubenIdx);
  });

  test("'wasser' ranks Mineralwasser above Thunfisch in Wasser", () => {
    const candidates = findCandidates("wasser", indexed);
    const scored = scoreAndRank(candidates, 1, defaultPrefs, new Map());
    const result = postProcess(scored, defaultPrefs);
    const names = result.map((r) => r.product.search_name_normalized);

    const mineralIdx = names.findIndex((n) => n.includes("mineralwasser"));
    const thunfischIdx = names.findIndex((n) => n.includes("thunfisch"));

    expect(mineralIdx).toBeGreaterThanOrEqual(0);
    expect(thunfischIdx).toBeGreaterThanOrEqual(0);
    expect(mineralIdx).toBeLessThan(thunfischIdx);
  });

  test("'batterien' finds product despite KA: prefix", () => {
    const candidates = findCandidates("batterien", indexed);
    expect(candidates.length).toBeGreaterThanOrEqual(1);
    expect(candidates[0].product.product_id).toBe("6");
  });

  test("'Rotwein Merlot' strips quantity suffix during indexing", () => {
    const product = indexed.find((p) => p.product_id === "1");
    expect(product?.search_name).toBe("Rotwein Merlot");
  });

  test("empty query returns no results", () => {
    const candidates = findCandidates("", indexed);
    expect(candidates).toHaveLength(0);
  });

  test("'wein' does NOT rank Schwein products as dominant", () => {
    // Add a Schwein product to test data
    const productsWithSchwein = [
      ...testProducts,
      {
        product_id: "7", name: "Bio Schwein Bratwurst 240g", name_normalized: "bio schwein bratwurst 240g",
        brand: null, price: 2.99, price_updated_at: null,
        assortment_type: "daily_range" as const, availability: "national" as const, region: null,
        country: "DE", special_start_date: null, special_end_date: null,
        status: "active" as const, source: "admin" as const, created_at: "", updated_at: "",
        demand_group: "68-Schweinefleisch, frisch", popularity_score: 0.5,
      } satisfies Product,
    ];
    const indexed = indexProducts(productsWithSchwein);
    const candidates = findCandidates("wein", indexed);
    const scored = scoreAndRank(candidates, 1, defaultPrefs, new Map());
    const result = postProcess(scored, defaultPrefs);
    const names = result.map((r) => r.product.search_name_normalized);

    // Schwein product should be far below actual wine products
    const schweinIdx = names.findIndex((n) => n.includes("schwein"));
    const rotweinIdx = names.findIndex((n) => n.includes("rotwein"));

    if (schweinIdx >= 0 && rotweinIdx >= 0) {
      expect(rotweinIdx).toBeLessThan(schweinIdx);
    }
  });

  test("'milch' ranks actual dairy above chocolate figures", () => {
    const milchProducts = [
      {
        product_id: "m1", name: "H-Milch 1.5pzt 1L HF3", name_normalized: "h-milch 1.5pzt 1l hf3",
        brand: null, price: 0.85, price_updated_at: null,
        assortment_type: "daily_range" as const, availability: "national" as const, region: null,
        country: "DE", special_start_date: null, special_end_date: null,
        status: "active" as const, source: "admin" as const, created_at: "", updated_at: "",
        demand_group: "50-H-Milchprodukte/Milchersatzprodukte", popularity_score: 0.8,
      } satisfies Product,
      {
        product_id: "m2", name: "Milch Maeuse, Erdbeere", name_normalized: "milch maeuse, erdbeere",
        brand: null, price: 2.49, price_updated_at: null,
        assortment_type: "daily_range" as const, availability: "national" as const, region: null,
        country: "DE", special_start_date: null, special_end_date: null,
        status: "active" as const, source: "admin" as const, created_at: "", updated_at: "",
        demand_group: "41-Schokolade/Pralinen", popularity_score: 0.4,
      } satisfies Product,
      {
        product_id: "m3", name: "Fettarme Milch 1.5% 1L", name_normalized: "fettarme milch 1.5% 1l",
        brand: null, price: 0.85, price_updated_at: null,
        assortment_type: "daily_range" as const, availability: "national" as const, region: null,
        country: "DE", special_start_date: null, special_end_date: null,
        status: "active" as const, source: "admin" as const, created_at: "", updated_at: "",
        demand_group: "50-H-Milchprodukte/Milchersatzprodukte", popularity_score: 0.75,
      } satisfies Product,
    ];
    const indexed = indexProducts(milchProducts);
    const candidates = findCandidates("milch", indexed);
    const scored = scoreAndRank(candidates, 1, defaultPrefs, new Map());
    const result = postProcess(scored, defaultPrefs);
    const ids = result.map((r) => r.product.product_id);

    // H-Milch and Fettarme Milch should rank above Milch Maeuse
    const hMilchIdx = ids.indexOf("m1");
    const fettarmeIdx = ids.indexOf("m3");
    const maeuseIdx = ids.indexOf("m2");

    expect(hMilchIdx).toBeGreaterThanOrEqual(0);
    expect(maeuseIdx).toBeGreaterThanOrEqual(0);
    expect(hMilchIdx).toBeLessThan(maeuseIdx);
    expect(fettarmeIdx).toBeLessThan(maeuseIdx);
  });
});
