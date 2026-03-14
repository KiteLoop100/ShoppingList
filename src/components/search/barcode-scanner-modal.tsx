"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { CompetitorProduct, Product } from "@/types";
import { useProducts } from "@/lib/products-context";
import { findProductByEan } from "@/lib/products/ean-utils";
import { findCompetitorProductByEan } from "@/lib/competitor-products/competitor-product-service";
import { useCompetitorProducts } from "@/lib/competitor-products/competitor-products-context";
import { fetchOpenFoodFacts } from "@/lib/products/open-food-facts";
import { useLiveBarcodeScanner } from "@/hooks/use-live-barcode-scanner";

export interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onProductAdded: (product: Product) => void;
  onProductNotFound: (ean: string) => void;
  onCompetitorProductFound?: (product: CompetitorProduct, ean: string) => void;
  onOpenFoodFactsResult?: (data: { name?: string; brand?: string; ean: string }) => void;
  /** When set (inventory context), this callback is used instead of onProductAdded. */
  onProductConsumed?: (product: Product) => void;
  /** Called when user chooses to create a new product from a not-found barcode. */
  onCreateProduct?: (ean: string, offData?: { name?: string; brand?: string }) => void;
}

type LookupPhase = "idle" | "looking-up" | "found" | "not-found" | "error";

export function BarcodeScannerModal({
  open,
  onClose,
  onProductAdded,
  onProductNotFound,
  onCompetitorProductFound,
  onOpenFoodFactsResult,
  onProductConsumed,
  onCreateProduct,
}: BarcodeScannerModalProps) {
  const t = useTranslations("search");
  const { products } = useProducts();
  const { products: competitorProducts } = useCompetitorProducts();

  const [lookupPhase, setLookupPhase] = useState<LookupPhase>("idle");
  const [detectedEan, setDetectedEan] = useState<string | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [offData, setOffData] = useState<{ name?: string; brand?: string } | null>(null);

  const processingRef = useRef(false);
  const mountedRef = useRef(true);
  const stopScanRef = useRef<() => void>(() => {});

  const handleDetected = useCallback(
    async (ean: string) => {
      if (processingRef.current) return;
      processingRef.current = true;

      setDetectedEan(ean);
      setLookupPhase("looking-up");
      stopScanRef.current();

      if (navigator.vibrate) navigator.vibrate(50);

      try {
        const [productResult, competitorResult, offSettled] = await Promise.allSettled([
          findProductByEan(ean, products),
          findCompetitorProductByEan(ean, competitorProducts),
          fetchOpenFoodFacts(ean),
        ]);
        if (!mountedRef.current) return;

        const product = productResult.status === "fulfilled" ? productResult.value : null;
        const competitor = competitorResult.status === "fulfilled" ? competitorResult.value : null;
        const offResult = offSettled.status === "fulfilled" ? offSettled.value : null;

        if (product) {
          const handler = onProductConsumed ?? onProductAdded;
          await Promise.resolve(handler(product));
          if (!mountedRef.current) return;
          setLookupPhase("found");
          setTimeout(() => { if (mountedRef.current) onClose(); }, 500);
          return;
        }

        if (competitor && onCompetitorProductFound) {
          setLookupPhase("found");
          onCompetitorProductFound(competitor, ean);
          setTimeout(() => { if (mountedRef.current) onClose(); }, 500);
          return;
        }

        const hasOffData = offResult && (offResult.name || offResult.brand);

        if (hasOffData && onOpenFoodFactsResult && !onCreateProduct) {
          setLookupPhase("found");
          onOpenFoodFactsResult({ name: offResult.name, brand: offResult.brand, ean });
          setTimeout(() => { if (mountedRef.current) onClose(); }, 500);
          return;
        }

        if (hasOffData) {
          setOffData({ name: offResult.name, brand: offResult.brand });
        }

        setLookupPhase("not-found");
        if (!onCreateProduct) {
          onProductNotFound(ean);
        }
      } catch (e) {
        if (!mountedRef.current) return;
        setLookupPhase("error");
        setLookupError(e instanceof Error ? e.message : t("addError"));
      }
    },
    [products, competitorProducts, onProductAdded, onProductNotFound, onCompetitorProductFound, onOpenFoodFactsResult, onProductConsumed, onCreateProduct, onClose, t],
  );

  const {
    videoRef,
    status: scanStatus,
    errorMessage: scanError,
    start,
    stop,
    restart,
  } = useLiveBarcodeScanner(handleDetected);

  stopScanRef.current = stop;

  // Start / stop scanner based on `open`
  useEffect(() => {
    mountedRef.current = true;
    if (open) {
      processingRef.current = false;
      setLookupPhase("idle");
      setDetectedEan(null);
      setLookupError(null);
      setOffData(null);
      void start();
    } else {
      stop();
    }
    return () => {
      mountedRef.current = false;
    };
  }, [open, start, stop]);

  const handleRestart = useCallback(() => {
    processingRef.current = false;
    setLookupPhase("idle");
    setDetectedEan(null);
    setLookupError(null);
    setOffData(null);
    restart();
  }, [restart]);

  if (!open) return null;

  const isScanning = lookupPhase === "idle" && (scanStatus === "scanning" || scanStatus === "initializing");
  const hasScanError = scanStatus === "error";
  const scanErrorText =
    scanError === "PERMISSION_DENIED" ? t("cameraPermissionDenied") : scanError;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("barcodeScanner")}
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-aldi-muted-light px-4 py-3">
          <h2 className="text-lg font-semibold text-aldi-blue">{t("barcodeScanner")}</h2>
          <button
            type="button"
            className="touch-target rounded-lg p-2 text-aldi-muted transition-colors hover:bg-aldi-muted-light/50 hover:text-aldi-text"
            onClick={onClose}
            aria-label={t("close")}
          >
            ✕
          </button>
        </div>

        {/* Camera feed */}
        <div className="relative min-h-[200px] overflow-hidden bg-black">
          <video
            ref={videoRef}
            className="h-full w-full object-cover"
            muted
            playsInline
          />
          {scanStatus === "initializing" && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            </div>
          )}
        </div>

        {/* Looking up */}
        {lookupPhase === "looking-up" && detectedEan && (
          <div className="border-t border-aldi-muted-light bg-aldi-muted-light/40 px-4 py-2">
            <p className="text-center text-sm font-medium text-aldi-blue">
              {t("barcodeDetected")}: {detectedEan}
            </p>
            <p className="text-center text-sm text-aldi-muted">{t("barcodeLookingUp")}</p>
          </div>
        )}

        {/* Scanner error (camera) */}
        {hasScanError && scanErrorText && (
          <p className="px-4 py-2 text-sm text-aldi-error">{scanErrorText}</p>
        )}

        {/* Lookup error */}
        {lookupPhase === "error" && lookupError && (
          <div className="border-t border-aldi-muted-light px-4 py-3">
            <p className="mb-3 px-3 py-2 text-center text-sm text-aldi-error">{lookupError}</p>
            <button
              type="button"
              className="w-full rounded-xl bg-aldi-blue px-4 py-3 font-medium text-white transition-opacity hover:opacity-90"
              onClick={handleRestart}
            >
              {t("barcodeScanAgain")}
            </button>
          </div>
        )}

        {/* Not found */}
        {lookupPhase === "not-found" && (
          <div className="border-t border-aldi-muted-light px-4 py-3">
            <p className="mb-3 rounded-lg bg-aldi-muted-light/60 px-3 py-2 text-center text-sm font-medium text-aldi-text">
              {t("productNotFoundInDb")}
            </p>
            {onCreateProduct && detectedEan && (
              <button
                type="button"
                className="mb-2 w-full rounded-xl bg-aldi-blue px-4 py-3 font-medium text-white transition-opacity hover:opacity-90"
                onClick={() => {
                  onCreateProduct(detectedEan, offData ?? undefined);
                  onClose();
                }}
              >
                {t("createProduct")}
              </button>
            )}
            <button
              type="button"
              className={`w-full rounded-xl px-4 py-3 font-medium transition-opacity hover:opacity-90 ${onCreateProduct ? "border border-aldi-blue text-aldi-blue" : "bg-aldi-blue text-white"}`}
              onClick={handleRestart}
            >
              {t("barcodeScanAgain")}
            </button>
          </div>
        )}

        {/* Found */}
        {lookupPhase === "found" && (
          <p className="px-4 py-2 text-center text-sm font-medium text-aldi-success">
            {t("barcodeProductAdded")}
          </p>
        )}

        {/* Scanning hint */}
        {isScanning && (
          <div className="border-t border-aldi-muted-light px-4 py-3">
            <p className="text-center text-sm text-aldi-muted">{t("barcodeScannerHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
