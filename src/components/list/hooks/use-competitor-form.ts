"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useCurrentCountry } from "@/lib/current-country-context";
import { getRetailersForCountry } from "@/lib/retailers/retailers";
import { log } from "@/lib/utils/logger";
import type { CompetitorProduct } from "@/types";
import type { ExtractedCompetitorProductInfo } from "@/lib/product-photo-studio/types";
import { saveCompetitorProduct } from "../competitor-form-save";

export interface UseCompetitorFormArgs {
  open: boolean;
  onClose: () => void;
  onSaved: (productId: string) => void;
  initialName?: string;
  initialRetailer?: string;
  initialEan?: string;
  initialBrand?: string;
  editProduct?: CompetitorProduct | null;
}

function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.82,
): Promise<{ base64: string; mediaType: string }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) { reject(new Error("Canvas not available")); return; }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      const [header, base64] = dataUrl.split(",");
      const mediaType = header.match(/data:(.*?);/)?.[1] ?? "image/jpeg";
      resolve({ base64, mediaType });
    };
    img.onerror = reject;
    img.src = objectUrl;
  });
}

function titleCase(s: string): string {
  return s.replace(/[a-zA-ZäöüÄÖÜßàáâãèéêìíîòóôùúûñç]+/g, (w) =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  );
}

export function useCompetitorForm({
  open, onClose, onSaved,
  initialName = "", initialRetailer = "", initialEan = "", initialBrand = "",
  editProduct,
}: UseCompetitorFormArgs) {
  const { country } = useCurrentCountry();
  const retailers = getRetailersForCountry(country ?? "DE");
  const isEditMode = !!editProduct;

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [ean, setEan] = useState("");
  const [retailer, setRetailer] = useState("");
  const [customRetailer, setCustomRetailer] = useState("");
  const [isBio, setIsBio] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [processedThumbnail, setProcessedThumbnail] = useState<string | null>(null);
  const [extractedDetails, setExtractedDetails] = useState<ExtractedCompetitorProductInfo | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    if (editProduct) {
      setName(editProduct.name);
      setBrand(editProduct.brand ?? "");
      setEan(editProduct.ean_barcode ?? "");
      setIsBio(editProduct.is_bio ?? false);
    } else {
      setName(initialName ? titleCase(initialName) : "");
      setBrand(initialBrand);
      setEan(initialEan);
      setRetailer(initialRetailer);
      setIsBio(false);
    }
    setPrice(""); setCustomRetailer("");
    setPhotoFiles([]); setPhotoPreviews([]);
    setProcessedThumbnail(null); setExtractedDetails(null);
    setReviewStatus(null); setError(null); setAnalyzing(false);
  }, [open, initialName, initialBrand, initialEan, initialRetailer, editProduct]);

  const handlePhotosSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setPhotoFiles(files);
    setPhotoPreviews(files.map((f) => URL.createObjectURL(f)));
    setAnalyzing(true); setError(null); setReviewStatus(null);
    try {
      const images = await Promise.all(
        files.map(async (file) => {
          const { base64, mediaType } = await compressImage(file);
          return { image_base64: base64, media_type: mediaType };
        }),
      );
      const res = await fetch("/api/analyze-competitor-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (data.status === "review_required") setReviewStatus(data.review_reason ?? "review_required");
      if (data.thumbnail_base64) setProcessedThumbnail(`data:image/jpeg;base64,${data.thumbnail_base64}`);
      const extracted = data.extracted_data as ExtractedCompetitorProductInfo | null;
      if (extracted) {
        setExtractedDetails(extracted);
        if (extracted.name) setName(titleCase(extracted.name));
        if (extracted.brand && !brand) setBrand(extracted.brand);
        if (extracted.ean_barcode && !ean) setEan(extracted.ean_barcode);
        if (extracted.price != null && !price) setPrice(String(extracted.price).replace(".", ","));
        if (extracted.retailer_from_price_tag && !retailer) {
          const m = retailers.find((r) => r.name.toLowerCase() === extracted.retailer_from_price_tag!.toLowerCase());
          if (m) setRetailer(m.name);
        }
        if (extracted.is_bio) setIsBio(true);
      }
    } catch (err) {
      log.error("[CompetitorProductForm] analysis failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [brand, ean, price, retailer, retailers]);

  const removePhoto = useCallback((index: number) => {
    setPhotoFiles((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviews((prev) => {
      if (prev[index]) URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const effectiveRetailer = retailer === "__custom__" ? customRetailer.trim() : retailer;

  const handleSubmit = useCallback(async () => {
    if (!name.trim() || (!isEditMode && !effectiveRetailer)) return;
    setSaving(true); setError(null);
    try {
      const productId = await saveCompetitorProduct({
        name: name.trim(), brand: brand.trim(), ean: ean.trim(), isBio,
        isEditMode, editProduct, effectiveRetailer, price,
        extractedDetails, processedThumbnail, photoFiles, country: country ?? "DE",
      });
      onSaved(productId); onClose();
    } catch (e: unknown) {
      log.error("[CompetitorProductForm] save failed:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }, [name, brand, price, ean, isBio, effectiveRetailer, photoFiles, processedThumbnail, extractedDetails, country, isEditMode, editProduct, onSaved, onClose]);

  const canSubmit = name.trim().length > 0
    && (isEditMode || effectiveRetailer.length > 0)
    && !saving && !analyzing;

  return {
    name, setName, brand, setBrand, price, setPrice,
    ean, setEan, retailer, setRetailer,
    customRetailer, setCustomRetailer,
    isBio, setIsBio,
    saving, analyzing, error,
    photoFiles, photoPreviews, processedThumbnail,
    extractedDetails, reviewStatus,
    fileInputRef,
    retailers, isEditMode, canSubmit,
    handlePhotosSelected, removePhoto, handleSubmit,
  };
}
