"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { Product } from "@/types";
import { useProducts } from "@/lib/products-context";
import { createClientIfConfigured } from "@/lib/supabase/client";

export interface BarcodeScannerModalProps {
  open: boolean;
  onClose: () => void;
  onProductAdded: (product: Product) => void;
  onProductNotFound: (ean: string) => void;
}

export function BarcodeScannerModal({
  open,
  onClose,
  onProductAdded,
  onProductNotFound,
}: BarcodeScannerModalProps) {
  const t = useTranslations("search");
  const { products } = useProducts();
  const containerRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "scanning" | "found" | "not-found" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scanKey, setScanKey] = useState(0);
  const scannerRef = useRef<import("html5-qrcode").Html5Qrcode | null>(null);

  const findProductByEan = async (ean: string): Promise<Product | null> => {
    const fromMemory = products.find((p) => p.ean_barcode === ean);
    if (fromMemory) return fromMemory;
    const supabase = createClientIfConfigured();
    if (!supabase) return null;
    const { data } = await supabase
      .from("products")
      .select("*")
      .eq("ean_barcode", ean)
      .eq("status", "active")
      .maybeSingle();
    if (!data) return null;
    return {
      product_id: String(data.product_id),
      article_number: data.article_number != null ? String(data.article_number) : null,
      ean_barcode: data.ean_barcode != null ? String(data.ean_barcode) : null,
      name: String(data.name),
      name_normalized: String(data.name_normalized),
      brand: data.brand != null ? String(data.brand) : null,
      demand_group: data.demand_group != null ? String(data.demand_group) : null,
      demand_sub_group: data.demand_sub_group != null ? String(data.demand_sub_group) : null,
      category_id: String(data.category_id),
      price: data.price != null ? Number(data.price) : null,
      price_updated_at: data.price_updated_at != null ? String(data.price_updated_at) : null,
      popularity_score: data.popularity_score != null ? Number(data.popularity_score) : null,
      assortment_type: (data.assortment_type as Product["assortment_type"]) ?? "daily_range",
      availability: (data.availability as Product["availability"]) ?? "national",
      region: data.region != null ? String(data.region) : null,
      country: data.country != null ? String(data.country) : "DE",
      special_start_date: data.special_start_date != null ? String(data.special_start_date) : null,
      special_end_date: data.special_end_date != null ? String(data.special_end_date) : null,
      status: (data.status as Product["status"]) ?? "active",
      source: (data.source as Product["source"]) ?? "admin",
      crowdsource_status: data.crowdsource_status != null ? (data.crowdsource_status as Product["crowdsource_status"]) : null,
      created_at: String(data.created_at),
      updated_at: String(data.updated_at),
    };
  };

  const restartScan = useCallback(() => {
    setStatus("scanning");
    setErrorMessage(null);
    setScanKey((k) => k + 1);
  }, []);

  useEffect(() => {
    if (!open || !containerRef.current) return;
    let mounted = true;
    const id = "barcode-reader-" + scanKey + "-" + Date.now();
    const div = document.createElement("div");
    div.id = id;
    div.style.width = "100%";
    div.style.minHeight = "200px";
    containerRef.current.innerHTML = "";
    containerRef.current.appendChild(div);

    import("html5-qrcode").then(({ Html5Qrcode }) => {
      if (!mounted || !containerRef.current) return;
      const scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;
      setStatus("scanning");
      setErrorMessage(null);
      scanner
        .start(
          { facingMode: "environment" },
          { fps: 10, qrbox: { width: 250, height: 120 } },
          async (decodedText) => {
            if (!mounted) return;
            scanner.stop().catch(() => {});
            scannerRef.current = null;
            const product = await findProductByEan(decodedText);
            if (!mounted) return;
            if (product) {
              try {
                await Promise.resolve(onProductAdded(product));
                if (!mounted) return;
                setStatus("found");
                setTimeout(() => {
                  if (mounted) onClose();
                }, 500);
              } catch (e) {
                if (!mounted) return;
                setStatus("error");
                setErrorMessage(e instanceof Error ? e.message : "Fehler beim Hinzufügen.");
              }
            } else {
              setStatus("not-found");
              onProductNotFound(decodedText);
            }
          },
          () => {}
        )
        .catch((err: Error) => {
          if (!mounted) return;
          setStatus("error");
          setErrorMessage(err.message || "Kamera nicht verfügbar");
        });
    });

    return () => {
      mounted = false;
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
        scannerRef.current = null;
      }
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  }, [open, scanKey]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={t("barcodeScanner")}
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col rounded-2xl bg-white shadow-xl">
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
        <div ref={containerRef} className="min-h-[200px] bg-black/5 p-2" />
        {status === "error" && errorMessage && (
          <p className="px-4 py-2 text-sm text-aldi-error">{errorMessage}</p>
        )}
        {status === "not-found" && (
          <div className="border-t border-aldi-muted-light px-4 py-3">
            <p className="mb-3 rounded-lg bg-aldi-muted-light/60 px-3 py-2 text-center text-sm font-medium text-aldi-text">
              {t("productNotFoundInDb")}
            </p>
            <button
              type="button"
              className="w-full rounded-xl bg-aldi-blue px-4 py-3 font-medium text-white transition-opacity hover:opacity-90"
              onClick={restartScan}
            >
              {t("barcodeScanAgain")}
            </button>
          </div>
        )}
        {status === "found" && (
          <p className="px-4 py-2 text-center text-sm font-medium text-aldi-success">
            {t("barcodeProductAdded")}
          </p>
        )}
        {(status === "scanning" || status === "idle") && (
          <div className="border-t border-aldi-muted-light px-4 py-3">
            <p className="text-center text-sm text-aldi-muted">{t("barcodeScannerHint")}</p>
          </div>
        )}
      </div>
    </div>
  );
}
