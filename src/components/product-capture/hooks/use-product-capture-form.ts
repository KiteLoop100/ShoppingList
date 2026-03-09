"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { useCurrentCountry } from "@/lib/current-country-context";
import { getRetailersForCountry } from "@/lib/retailers/retailers";
import {
  fetchDemandGroupsFromSupabase,
  toDemandGroups,
  fetchDemandSubGroupsFromSupabase,
  type DemandSubGroupRow,
} from "@/lib/categories/category-service";
import { log } from "@/lib/utils/logger";
import type { Product, CompetitorProduct, DemandGroup } from "@/types";
import type { ExtractedProductInfo } from "@/lib/product-photo-studio/types";
import { extractDemandGroupCode } from "@/lib/competitor-products/categorize-competitor-product";
import { saveProduct, type SaveResult } from "../product-capture-save";

export interface ProductCaptureValues {
  name: string;
  brand: string;
  retailer: string;
  customRetailer: string;
  demandGroupCode: string;
  demandSubGroup: string;
  ean: string;
  articleNumber: string;
  price: string;
  weightOrQuantity: string;
  assortmentType: string;
  isBio: boolean;
  isVegan: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  animalWelfareLevel: number | null;
}

export interface ProductCaptureConfig {
  open: boolean;
  mode: "create" | "edit";
  onClose: () => void;
  onSaved: (productId: string, productType: "aldi" | "competitor", name: string) => void;
  initialValues?: Partial<ProductCaptureValues>;
  hiddenFields?: string[];
  lockedFields?: string[];
  editAldiProduct?: Product | null;
  editCompetitorProduct?: CompetitorProduct | null;
}

export function compressImage(
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

export function titleCase(s: string): string {
  return s.replace(/[a-zA-ZäöüÄÖÜßàáâãèéêìíîòóôùúûñç]+/g, (w) =>
    w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
  );
}

function initFromAldiProduct(p: Product): Partial<ProductCaptureValues> {
  return {
    name: p.name,
    brand: p.brand ?? "",
    retailer: "ALDI",
    demandGroupCode: p.demand_group_code ?? "",
    demandSubGroup: p.demand_sub_group ?? "",
    ean: p.ean_barcode ?? "",
    articleNumber: p.article_number ?? "",
    price: p.price != null ? String(p.price) : "",
    weightOrQuantity: p.weight_or_quantity ?? "",
    assortmentType: p.assortment_type ?? "daily_range",
    isBio: p.is_bio ?? false,
    isVegan: p.is_vegan ?? false,
    isGlutenFree: p.is_gluten_free ?? false,
    isLactoseFree: p.is_lactose_free ?? false,
    animalWelfareLevel: p.animal_welfare_level ?? null,
  };
}

function initFromCompetitorProduct(p: CompetitorProduct): Partial<ProductCaptureValues> {
  return {
    name: p.name,
    brand: p.brand ?? "",
    retailer: p.retailer ?? "",
    demandGroupCode: p.demand_group_code ?? "",
    demandSubGroup: p.demand_sub_group ?? "",
    ean: p.ean_barcode ?? "",
    articleNumber: p.article_number ?? "",
    weightOrQuantity: p.weight_or_quantity ?? "",
    assortmentType: p.assortment_type ?? "daily_range",
    isBio: p.is_bio ?? false,
    isVegan: p.is_vegan ?? false,
    isGlutenFree: p.is_gluten_free ?? false,
    isLactoseFree: p.is_lactose_free ?? false,
    animalWelfareLevel: p.animal_welfare_level ?? null,
  };
}

const EMPTY_VALUES: ProductCaptureValues = {
  name: "", brand: "", retailer: "", customRetailer: "",
  demandGroupCode: "", demandSubGroup: "", ean: "", articleNumber: "",
  price: "", weightOrQuantity: "", assortmentType: "daily_range",
  isBio: false, isVegan: false, isGlutenFree: false, isLactoseFree: false,
  animalWelfareLevel: null,
};

const MAX_TOTAL_BASE64_BYTES = 15_000_000;

export function useProductCaptureForm(config: ProductCaptureConfig) {
  const { open, mode, onClose, onSaved, initialValues, lockedFields, editAldiProduct, editCompetitorProduct } = config;
  const locked = useMemo(() => new Set(lockedFields ?? []), [lockedFields]);
  const { country } = useCurrentCountry();
  const retailers = getRetailersForCountry(country ?? "DE");

  const [values, setValues] = useState<ProductCaptureValues>(EMPTY_VALUES);
  const [saving, setSaving] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoFiles, setPhotoFiles] = useState<File[]>([]);
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [processedThumbnail, setProcessedThumbnail] = useState<string | null>(null);
  const [thumbnailType, setThumbnailType] = useState<"background_removed" | "soft_fallback" | null>(null);
  const [extractedDetails, setExtractedDetails] = useState<ExtractedProductInfo | null>(null);
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [demandGroups, setDemandGroups] = useState<DemandGroup[]>([]);
  const [allSubGroups, setAllSubGroups] = useState<DemandSubGroupRow[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null!);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isEditMode = mode === "edit";

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchDemandGroupsFromSupabase(),
      fetchDemandSubGroupsFromSupabase(),
    ]).then(([dgRows, dsgRows]) => {
      if (cancelled) return;
      if (dgRows) setDemandGroups(toDemandGroups(dgRows));
      if (dsgRows) setAllSubGroups(dsgRows);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!open) return;

    let init: Partial<ProductCaptureValues> = {};
    if (editAldiProduct) {
      init = initFromAldiProduct(editAldiProduct);
    } else if (editCompetitorProduct) {
      init = initFromCompetitorProduct(editCompetitorProduct);
    } else if (initialValues) {
      if (initialValues.name) init.name = titleCase(initialValues.name);
      else init.name = "";
      init = { ...init, ...initialValues };
      if (initialValues.name && !init.name) init.name = titleCase(initialValues.name);
    }

    setValues({ ...EMPTY_VALUES, ...init });
    setPhotoFiles([]); setPhotoPreviews([]);
    setProcessedThumbnail(null); setThumbnailType(null);
    setExtractedDetails(null);
    setReviewStatus(null); setError(null); setAnalyzing(false);
  }, [open, editAldiProduct, editCompetitorProduct, initialValues]);

  const filteredSubGroups = allSubGroups.filter(
    (sg) => sg.demand_group_code === values.demandGroupCode,
  );

  const setField = useCallback(<K extends keyof ProductCaptureValues>(key: K, value: ProductCaptureValues[K]) => {
    setValues((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "demandGroupCode") next.demandSubGroup = "";
      return next;
    });
  }, []);

  const handlePhotosSelected = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

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

      const totalBytes = images.reduce((sum, img) => sum + img.image_base64.length, 0);
      if (totalBytes > MAX_TOTAL_BASE64_BYTES) {
        throw new Error(`Bilder sind zu groß (${(totalBytes / 1_000_000).toFixed(1)} MB). Bitte weniger oder kleinere Fotos verwenden.`);
      }

      const res = await fetch("/api/analyze-product-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images }),
        signal: controller.signal,
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      if (controller.signal.aborted) return;

      if (data.thumbnail_base64) {
        const fmt = data.thumbnail_format ?? "image/webp";
        setProcessedThumbnail(`data:${fmt};base64,${data.thumbnail_base64}`);
        setThumbnailType(data.thumbnail_type ?? null);
      }
      if (data.status === "review_required" && !data.thumbnail_base64) {
        setReviewStatus(data.review_reason ?? "review_required");
      }
      const extracted = data.extracted_data as ExtractedProductInfo | null;
      if (extracted) {
        setExtractedDetails(extracted);
        const aiDemandGroupCode = extractDemandGroupCode(extracted.demand_group);
        setValues((prev) => ({
          ...prev,
          name: locked.has("name") ? prev.name
            : (extracted.name && !prev.name) ? titleCase(extracted.name) : prev.name,
          brand: (extracted.brand && !prev.brand) ? extracted.brand : prev.brand,
          ean: (extracted.ean_barcode && !prev.ean) ? extracted.ean_barcode : prev.ean,
          articleNumber: locked.has("articleNumber") ? prev.articleNumber
            : (extracted.article_number && !prev.articleNumber) ? extracted.article_number : prev.articleNumber,
          price: locked.has("price") ? prev.price
            : (extracted.price != null && !prev.price) ? String(extracted.price).replace(".", ",") : prev.price,
          weightOrQuantity: (extracted.weight_or_quantity && !prev.weightOrQuantity) ? extracted.weight_or_quantity : prev.weightOrQuantity,
          demandGroupCode: (aiDemandGroupCode && !prev.demandGroupCode) ? aiDemandGroupCode : prev.demandGroupCode,
          isBio: extracted.is_bio || prev.isBio,
          isVegan: extracted.is_vegan || prev.isVegan,
          isGlutenFree: extracted.is_gluten_free || prev.isGlutenFree,
          isLactoseFree: extracted.is_lactose_free || prev.isLactoseFree,
          animalWelfareLevel: extracted.animal_welfare_level ?? prev.animalWelfareLevel,
          retailer: (extracted.retailer_from_price_tag && !prev.retailer)
            ? (retailers.find((r) => r.name.toLowerCase() === extracted.retailer_from_price_tag!.toLowerCase())?.name ?? prev.retailer)
            : prev.retailer,
        }));
      }
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      log.error("[ProductCaptureForm] analysis failed:", err);
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [retailers, locked]);

  const removePhoto = useCallback((index: number) => {
    setPhotoFiles((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length === 0) {
        setProcessedThumbnail(null);
        setThumbnailType(null);
        setExtractedDetails(null);
        setReviewStatus(null);
      }
      return next;
    });
    setPhotoPreviews((prev) => {
      if (prev[index]) URL.revokeObjectURL(prev[index]);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const effectiveRetailer = values.retailer === "__custom__" ? values.customRetailer.trim() : values.retailer;

  const canSubmit = values.name.trim().length > 0
    && (isEditMode || effectiveRetailer.length > 0)
    && !saving && !analyzing;

  const handleSubmit = useCallback(async () => {
    if (!canSubmit) return;
    setSaving(true); setError(null);
    try {
      const submitValues = { ...values, retailer: effectiveRetailer };
      const result: SaveResult = await saveProduct({
        values: submitValues,
        editAldiProduct: editAldiProduct ?? null,
        editCompetitorProduct: editCompetitorProduct ?? null,
        extractedDetails,
        processedThumbnail,
        photoFiles,
        country: country ?? "DE",
      });
      onSaved(result.productId, result.productType, result.name);
      onClose();
    } catch (e: unknown) {
      log.error("[ProductCaptureForm] save failed:", e);
      setError(e instanceof Error ? e.message : String(e));
    } finally { setSaving(false); }
  }, [canSubmit, values, effectiveRetailer, editAldiProduct, editCompetitorProduct, extractedDetails, processedThumbnail, photoFiles, country, onSaved, onClose]);

  return {
    values, setField, setValues,
    saving, analyzing, error,
    photoFiles, photoPreviews, processedThumbnail, thumbnailType,
    extractedDetails, reviewStatus,
    fileInputRef,
    retailers, demandGroups, filteredSubGroups,
    isEditMode, canSubmit, locked,
    handlePhotosSelected, removePhoto, handleSubmit,
  };
}
