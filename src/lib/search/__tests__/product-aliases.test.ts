import { expandQuery, _resetAliasMap } from "../product-aliases";
import { indexProducts } from "../search-indexer";
import { findCandidates } from "../candidate-retrieval";
import type { Product } from "@/types";

beforeEach(() => {
  _resetAliasMap();
});

describe("expandQuery", () => {
  test("exact alias match returns alternative terms", () => {
    const result = expandQuery("hafermilch");
    expect(result).toContain("haferdrink");
  });

  test("reverse direction also works", () => {
    const result = expandQuery("haferdrink");
    expect(result).toContain("hafermilch");
  });

  test("multi-word query with alias word gets expanded", () => {
    const result = expandQuery("bio hafermilch");
    expect(result).toContain("bio haferdrink");
  });

  test("reibekase expands to geriebener kase", () => {
    const result = expandQuery("reibekase");
    expect(result).toContain("geriebener kase");
  });

  test("klopapier expands to toilettenpapier", () => {
    const result = expandQuery("klopapier");
    expect(result).toContain("toilettenpapier");
  });

  test("query without alias returns empty array", () => {
    const result = expandQuery("schokolade");
    expect(result).toHaveLength(0);
  });

  test("pommes expands to both frites variants", () => {
    const result = expandQuery("pommes");
    expect(result).toContain("backofen frites");
    expect(result).toContain("frites");
  });

  test("hackfleisch expands to multiple animal-specific variants", () => {
    const result = expandQuery("hackfleisch");
    expect(result).toContain("rinderhackfleisch");
    expect(result).toContain("schweinehackfleisch");
    expect(result).toContain("mischgehacktes");
  });

  test("compound word containing alias term gets expanded", () => {
    const result = expandQuery("sojamilchpulver");
    expect(result).toContain("sojadrinkpulver");
  });

  // ──── New alias coverage ────

  test("schmand expands to sauerrahm", () => {
    const result = expandQuery("schmand");
    expect(result).toContain("sauerrahm");
  });

  test("kartoffeln expands to speisekartoffeln", () => {
    const result = expandQuery("kartoffeln");
    expect(result).toContain("speisekartoffeln");
  });

  test("mayo expands to mayonnaise variants", () => {
    const result = expandQuery("mayo");
    expect(result).toContain("mayonnaise");
    expect(result).toContain("delikatess mayonnaise");
  });

  test("semmel expands to brotchen (regional variant)", () => {
    const result = expandQuery("semmel");
    expect(result).toContain("brotchen");
  });

  test("alufolie expands to aluminiumfolie", () => {
    const result = expandQuery("alufolie");
    expect(result).toContain("aluminiumfolie");
  });

  test("deo expands to deodorant and antitranspirant", () => {
    const result = expandQuery("deo");
    expect(result).toContain("deodorant");
    expect(result).toContain("antitranspirant");
  });

  test("faschiertes expands to hackfleisch (Austrian variant)", () => {
    const result = expandQuery("faschiertes");
    expect(result).toContain("hackfleisch");
  });

  test("sprudel expands to mineralwasser", () => {
    const result = expandQuery("sprudel");
    expect(result).toContain("mineralwasser");
  });

  test("chicken expands to hahnchen", () => {
    const result = expandQuery("chicken");
    expect(result).toContain("hahnchen");
  });

  test("nutella expands to nuss nougat creme and nusskati", () => {
    const result = expandQuery("nutella");
    expect(result).toContain("nuss nougat creme");
    expect(result).toContain("nusskati");
  });

  test("toast expands to buttertoast", () => {
    const result = expandQuery("toast");
    expect(result).toContain("buttertoast");
  });

  test("gurke expands to salatgurke", () => {
    const result = expandQuery("gurke");
    expect(result).toContain("salatgurke");
  });

  test("mohren expands to karotten", () => {
    const result = expandQuery("mohren");
    expect(result).toContain("karotten");
  });
});

const aliasTestProducts: Product[] = [
  {
    product_id: "a1", name: "Haferdrink Natur 1L", name_normalized: "haferdrink natur 1l",
    brand: "MILSA", price: 1.29, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group_code: "50", popularity_score: 0.6,
  },
  {
    product_id: "a2", name: "Bio Haferdrink Barista 1L", name_normalized: "bio haferdrink barista 1l",
    brand: "MILSA", price: 1.69, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group_code: "50", popularity_score: 0.5,
  },
  {
    product_id: "a3", name: "Geriebener Käse Gouda 250g", name_normalized: "geriebener kase gouda 250g",
    brand: null, price: 1.99, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group_code: "84", popularity_score: 0.7,
  },
  {
    product_id: "a4", name: "Toilettenpapier 3-lagig 10 Rollen", name_normalized: "toilettenpapier 3 lagig 10 rollen",
    brand: "KOKETT", price: 3.45, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group_code: "10", popularity_score: 0.8,
  },
  {
    product_id: "a5", name: "H-Milch 1.5% 1L", name_normalized: "h milch 1 5 1l",
    brand: null, price: 0.85, price_updated_at: null,
    assortment_type: "daily_range", availability: "national", region: null,
    country: "DE", special_start_date: null, special_end_date: null,
    status: "active", source: "admin", created_at: "", updated_at: "",
    demand_group_code: "50", popularity_score: 0.9,
  },
] satisfies Product[];

describe("findCandidates with aliases", () => {
  const indexed = indexProducts(aliasTestProducts);

  test("'hafermilch' finds Haferdrink products via alias expansion", () => {
    const candidates = findCandidates("hafermilch", indexed);
    const ids = candidates.map((c) => c.product.product_id);
    expect(ids).toContain("a1");
    expect(ids).toContain("a2");
  });

  test("'haferdrink' still finds Haferdrink products directly (no regression)", () => {
    const candidates = findCandidates("haferdrink", indexed);
    const ids = candidates.map((c) => c.product.product_id);
    expect(ids).toContain("a1");
    expect(ids).toContain("a2");
  });

  test("'reibekäse' finds 'Geriebener Käse' via alias expansion", () => {
    const candidates = findCandidates("reibekäse", indexed);
    const ids = candidates.map((c) => c.product.product_id);
    expect(ids).toContain("a3");
  });

  test("'geriebener käse' still finds the product directly", () => {
    const candidates = findCandidates("geriebener käse", indexed);
    const ids = candidates.map((c) => c.product.product_id);
    expect(ids).toContain("a3");
  });

  test("'klopapier' finds Toilettenpapier via alias expansion", () => {
    const candidates = findCandidates("klopapier", indexed);
    const ids = candidates.map((c) => c.product.product_id);
    expect(ids).toContain("a4");
  });

  test("'bio hafermilch' finds 'Bio Haferdrink' via multi-word alias expansion", () => {
    const candidates = findCandidates("bio hafermilch", indexed);
    const ids = candidates.map((c) => c.product.product_id);
    expect(ids).toContain("a2");
  });

  test("direct name match is not downgraded by alias presence", () => {
    const candidates = findCandidates("haferdrink", indexed);
    const haferdrink = candidates.find((c) => c.product.product_id === "a1");
    expect(haferdrink).toBeDefined();
    // Direct "haferdrink" on "Haferdrink Natur 1L" should be NAME_STARTS_WITH (2)
    // not something worse
    expect(haferdrink!.matchType).toBeLessThanOrEqual(3);
  });

  test("alias does not produce false positives for unrelated products", () => {
    const candidates = findCandidates("hafermilch", indexed);
    const ids = candidates.map((c) => c.product.product_id);
    expect(ids).not.toContain("a5"); // H-Milch should not match "hafermilch"
  });
});
