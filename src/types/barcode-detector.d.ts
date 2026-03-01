/**
 * Ambient type declarations for the BarcodeDetector Web API.
 * @see https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector
 */

type BarcodeFormat =
  | "aztec"
  | "codabar"
  | "code_39"
  | "code_93"
  | "code_128"
  | "data_matrix"
  | "ean_8"
  | "ean_13"
  | "itf"
  | "pdf417"
  | "qr_code"
  | "upc_a"
  | "upc_e"
  | "unknown";

interface DetectedBarcode {
  readonly boundingBox: DOMRectReadOnly;
  readonly cornerPoints: ReadonlyArray<{ x: number; y: number }>;
  readonly format: BarcodeFormat;
  readonly rawValue: string;
}

interface BarcodeDetectorOptions {
  formats?: BarcodeFormat[];
}

declare class BarcodeDetector {
  constructor(options?: BarcodeDetectorOptions);
  static getSupportedFormats(): Promise<BarcodeFormat[]>;
  detect(source: ImageBitmapSource): Promise<DetectedBarcode[]>;
}

interface Window {
  BarcodeDetector?: typeof BarcodeDetector;
}
