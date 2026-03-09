import {
  isLastTripCommand,
  isAktionsartikelCommand,
  parseReceiptCommand,
  buildReceiptCommand,
  detectReceiptPhrase,
} from "../commands";

describe("isLastTripCommand", () => {
  test("matches exact phrase", () => {
    expect(isLastTripCommand("letzte einkäufe")).toBe(true);
  });

  test("matches prefix of phrase", () => {
    expect(isLastTripCommand("letzte")).toBe(true);
  });

  test("does not match unrelated query", () => {
    expect(isLastTripCommand("milch")).toBe(false);
  });

  test("returns false for empty string", () => {
    expect(isLastTripCommand("")).toBe(false);
  });
});

describe("isAktionsartikelCommand", () => {
  test("matches aktionsartikel", () => {
    expect(isAktionsartikelCommand("aktionsartikel")).toBe(true);
  });

  test("matches angebote", () => {
    expect(isAktionsartikelCommand("angebote")).toBe(true);
  });

  test("does not match unrelated query", () => {
    expect(isAktionsartikelCommand("butter")).toBe(false);
  });
});

describe("parseReceiptCommand", () => {
  test("parses single mode command", () => {
    const result = parseReceiptCommand("__receipt:ALDI:single:0");
    expect(result).toEqual({ retailer: "ALDI", mode: "single", n: 0 });
  });

  test("parses combined mode command", () => {
    const result = parseReceiptCommand("__receipt:REWE:combined:3");
    expect(result).toEqual({ retailer: "REWE", mode: "combined", n: 3 });
  });

  test("parses not-recently mode command", () => {
    const result = parseReceiptCommand("__receipt:ALDI:not-recently:0");
    expect(result).toEqual({ retailer: "ALDI", mode: "not-recently", n: 0 });
  });

  test("returns null for regular queries", () => {
    expect(parseReceiptCommand("milch")).toBeNull();
    expect(parseReceiptCommand("letzte einkäufe")).toBeNull();
  });

  test("returns null for invalid mode", () => {
    expect(parseReceiptCommand("__receipt:ALDI:invalid:0")).toBeNull();
  });

  test("returns null for negative n", () => {
    expect(parseReceiptCommand("__receipt:ALDI:single:-1")).toBeNull();
  });

  test("returns null for non-numeric n", () => {
    expect(parseReceiptCommand("__receipt:ALDI:single:abc")).toBeNull();
  });

  test("returns null for wrong number of parts", () => {
    expect(parseReceiptCommand("__receipt:ALDI:single")).toBeNull();
    expect(parseReceiptCommand("__receipt:ALDI:single:0:extra")).toBeNull();
  });

  test("returns null for empty retailer", () => {
    expect(parseReceiptCommand("__receipt::single:0")).toBeNull();
  });

  test("handles whitespace", () => {
    const result = parseReceiptCommand("  __receipt:ALDI:single:0  ");
    expect(result).toEqual({ retailer: "ALDI", mode: "single", n: 0 });
  });
});

describe("buildReceiptCommand", () => {
  test("builds single command", () => {
    expect(buildReceiptCommand("ALDI", "single", 0)).toBe("__receipt:ALDI:single:0");
  });

  test("builds combined command", () => {
    expect(buildReceiptCommand("REWE", "combined", 3)).toBe("__receipt:REWE:combined:3");
  });

  test("builds not-recently command", () => {
    expect(buildReceiptCommand("ALDI", "not-recently", 0)).toBe("__receipt:ALDI:not-recently:0");
  });

  test("roundtrips with parseReceiptCommand", () => {
    const cmd = buildReceiptCommand("LIDL", "combined", 4);
    const parsed = parseReceiptCommand(cmd);
    expect(parsed).toEqual({ retailer: "LIDL", mode: "combined", n: 4 });
  });
});

describe("detectReceiptPhrase", () => {
  test("detects 'letzter einkauf' as single:0 for ALDI", () => {
    expect(detectReceiptPhrase("Letzter Einkauf")).toEqual({
      retailer: "ALDI", mode: "single", n: 0,
    });
  });

  test("detects 'vorletzter einkauf' as single:1", () => {
    expect(detectReceiptPhrase("Vorletzter Einkauf")).toEqual({
      retailer: "ALDI", mode: "single", n: 1,
    });
  });

  test("detects 'vorvorletzter einkauf' as single:2", () => {
    expect(detectReceiptPhrase("vorvorletzter einkauf")).toEqual({
      retailer: "ALDI", mode: "single", n: 2,
    });
  });

  test("detects 'letzten zwei einkäufe' as combined:2", () => {
    expect(detectReceiptPhrase("Letzten zwei Einkäufe")).toEqual({
      retailer: "ALDI", mode: "combined", n: 2,
    });
  });

  test("detects 'letzten drei einkäufe' as combined:3", () => {
    expect(detectReceiptPhrase("Letzten drei Einkäufe")).toEqual({
      retailer: "ALDI", mode: "combined", n: 3,
    });
  });

  test("detects 'letzten vier einkäufe' as combined:4", () => {
    expect(detectReceiptPhrase("letzten vier einkäufe")).toEqual({
      retailer: "ALDI", mode: "combined", n: 4,
    });
  });

  test("detects 'länger nicht gekauft' as not-recently:0", () => {
    expect(detectReceiptPhrase("länger nicht gekauft")).toEqual({
      retailer: "ALDI", mode: "not-recently", n: 0,
    });
  });

  test("does not match partial prefix (avoids hijacking old commands)", () => {
    expect(detectReceiptPhrase("vorletz")).toBeNull();
    expect(detectReceiptPhrase("letzte")).toBeNull();
  });

  test("does not match 'letzte einkäufe' (plural stays old behavior)", () => {
    expect(detectReceiptPhrase("letzte einkäufe")).toBeNull();
  });

  test("returns null for unrelated queries", () => {
    expect(detectReceiptPhrase("milch")).toBeNull();
    expect(detectReceiptPhrase("butter")).toBeNull();
  });

  test("returns null for empty string", () => {
    expect(detectReceiptPhrase("")).toBeNull();
  });
});
