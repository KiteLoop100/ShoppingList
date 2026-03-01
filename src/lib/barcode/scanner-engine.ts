/**
 * Barcode detection engine with two backends:
 * 1. Native BarcodeDetector API (hardware-accelerated, Chrome/Edge/Safari 17+)
 * 2. ZBar WASM fallback (all browsers, lazy-loaded only when needed)
 *
 * The engine exposes a uniform interface; consumers don't need to know
 * which backend is active.
 */

const EAN_REGEX = /^\d{8,14}$/;

const EAN_FORMATS: BarcodeFormat[] = ["ean_13", "ean_8", "upc_a"];

const ZBAR_EAN_TYPES = new Set([
  "EAN-13", "EAN-8", "UPC-A",
  "ZBAR_EAN13", "ZBAR_EAN8", "ZBAR_UPCA",
]);

export interface ScannerEngine {
  scanFrame(source: ImageData): Promise<string | null>;
  /**
   * Optional fast path: pass a video element directly to BarcodeDetector,
   * avoiding the canvas round-trip. Only available on the native engine.
   */
  scanVideo?(video: HTMLVideoElement): Promise<string | null>;
  dispose(): void;
}

function extractEan(rawValue: string | undefined | null): string | null {
  const v = rawValue?.trim();
  return v && EAN_REGEX.test(v) ? v : null;
}

// ---------------------------------------------------------------------------
// Native BarcodeDetector engine
// ---------------------------------------------------------------------------

function createNativeEngine(formats: BarcodeFormat[]): ScannerEngine {
  const detector = new BarcodeDetector({ formats });

  async function scan(source: ImageBitmapSource): Promise<string | null> {
    const results = await detector.detect(source);
    for (const barcode of results) {
      const ean = extractEan(barcode.rawValue);
      if (ean) return ean;
    }
    return null;
  }

  return {
    scanFrame: (source) => scan(source),
    scanVideo: (video) => scan(video),
    dispose() {},
  };
}

// ---------------------------------------------------------------------------
// ZBar WASM engine (lazy-loaded)
// ---------------------------------------------------------------------------

type ScanImageDataFn = (image: ImageData) => Promise<Array<{ typeName: string; decode(encoding?: string): string }>>;

function createZBarEngine(): ScannerEngine {
  let scanFn: ScanImageDataFn | null = null;
  let loadFailed = false;

  const ready = import("@undecaf/zbar-wasm")
    .then((mod: { scanImageData: ScanImageDataFn }) => {
      scanFn = mod.scanImageData;
    })
    .catch(() => {
      loadFailed = true;
    });

  return {
    async scanFrame(source: ImageData): Promise<string | null> {
      if (!scanFn && !loadFailed) await ready;
      if (!scanFn) return null;

      const symbols = await scanFn(source);
      for (const sym of symbols) {
        if (!ZBAR_EAN_TYPES.has(sym.typeName)) continue;
        const ean = extractEan(sym.decode());
        if (ean) return ean;
      }
      return null;
    },

    dispose() {
      scanFn = null;
    },
  };
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------

async function isNativeSupported(): Promise<BarcodeFormat[] | null> {
  if (typeof window === "undefined" || !window.BarcodeDetector) return null;
  try {
    const supported = await BarcodeDetector.getSupportedFormats();
    const available = EAN_FORMATS.filter((f) => supported.includes(f));
    return available.length > 0 ? available : null;
  } catch {
    return null;
  }
}

export async function createScannerEngine(): Promise<ScannerEngine> {
  const nativeFormats = await isNativeSupported();
  if (nativeFormats) return createNativeEngine(nativeFormats);
  return createZBarEngine();
}
