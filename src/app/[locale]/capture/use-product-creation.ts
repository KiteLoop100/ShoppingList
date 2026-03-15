"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { db } from "@/lib/db";
import { fetchDemandGroupsFromSupabase, fetchDemandSubGroupsFromSupabase } from "@/lib/categories/category-service";
import { generateId } from "@/lib/utils/generate-id";
import { compressImage, rotateImageFile } from "@/lib/utils/image-utils";
import { log } from "@/lib/utils/logger";
import type { SlotPhoto, PhotoSlotPurpose } from "@/components/guided-photo-slots";
import type { ProcessedGalleryPhotoClient } from "@/components/product-capture/hooks/use-product-capture-form";

const MAX_TOTAL_BASE64_BYTES = 15_000_000;

export interface ProductFormFields {
  name: string;
  brand: string;
  price: string;
  ean: string;
  articleNumber: string;
  weightOrQuantity: string;
  demandGroup: string;
  demandSubGroup: string;
  ingredients: string;
  allergens: string;
  assortmentType: "daily_range" | "special_food" | "special_nonfood";
}

export function useProductCreation(options: {
  open: boolean;
  onSaved?: () => void;
  onClose: () => void;
}) {
  const { open, onSaved, onClose } = options;

  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [price, setPrice] = useState("");
  const [ean, setEan] = useState("");
  const [articleNumber, setArticleNumber] = useState("");
  const [weightOrQuantity, setWeightOrQuantity] = useState("");
  const [demandGroup, setDemandGroup] = useState("");
  const [demandSubGroup, setDemandSubGroup] = useState("");
  const [ingredients, setIngredients] = useState("");
  const [allergens, setAllergens] = useState("");
  const [assortmentType, setAssortmentType] = useState<"daily_range" | "special_food" | "special_nonfood">("daily_range");

  const [frontPhoto, setFrontPhoto] = useState<SlotPhoto | null>(null);
  const [priceTagPhoto, setPriceTagPhoto] = useState<SlotPhoto | null>(null);
  const [extraPhotos, setExtraPhotos] = useState<SlotPhoto[]>([]);
  const [processedThumbnail, setProcessedThumbnail] = useState<string | null>(null);
  const [thumbnailType, setThumbnailType] = useState<"background_removed" | "soft_fallback" | null>(null);
  const [processedGalleryPhotos, setProcessedGalleryPhotos] = useState<ProcessedGalleryPhotoClient[]>([]);
  const [analyzing, setAnalyzing] = useState(false);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicateProductId, setDuplicateProductId] = useState<string | null>(null);

  const fileInputFrontRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const fileInputPriceRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const fileInputExtraRef = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const abortControllerRef = useRef<AbortController | null>(null);

  const resetForm = useCallback(() => {
    setName(""); setBrand(""); setPrice(""); setEan("");
    setArticleNumber(""); setWeightOrQuantity("");
    setDemandGroup(""); setDemandSubGroup("");
    setIngredients(""); setAllergens("");
    setAssortmentType("daily_range");
    if (frontPhoto) URL.revokeObjectURL(frontPhoto.previewUrl);
    if (priceTagPhoto) URL.revokeObjectURL(priceTagPhoto.previewUrl);
    extraPhotos.forEach((sp) => URL.revokeObjectURL(sp.previewUrl));
    setFrontPhoto(null); setPriceTagPhoto(null); setExtraPhotos([]);
    setProcessedThumbnail(null); setThumbnailType(null);
    setProcessedGalleryPhotos([]);
    setAnalyzing(false);
    setSaving(false); setSaveError(null); setDuplicateProductId(null);
  }, [frontPhoto, priceTagPhoto, extraPhotos]);

  useEffect(() => {
    if (open) resetForm();
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  interface DgOption { code: string; name: string }
  interface SgOption { code: string; name: string; demand_group_code: string }
  const [demandGroupOptions, setDemandGroupOptions] = useState<DgOption[]>([]);
  const [allSubGroups, setAllSubGroups] = useState<SgOption[]>([]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [idbGroups, sbGroups, idbSubs, sbSubs] = await Promise.all([
        db.demand_groups.toArray(),
        fetchDemandGroupsFromSupabase(),
        db.demand_sub_groups.toArray().catch(() => [] as SgOption[]),
        fetchDemandSubGroupsFromSupabase(),
      ]);
      if (cancelled) return;
      const groups: DgOption[] = idbGroups.map((dg) => ({ code: dg.code, name: dg.name }));
      if (sbGroups) {
        const codes = new Set(groups.map((g) => g.code));
        for (const r of sbGroups) {
          if (!codes.has(r.code)) groups.push({ code: r.code, name: r.name });
        }
      }
      setDemandGroupOptions(groups);
      const subs: SgOption[] = (idbSubs ?? []).map((s: { code: string; name: string; demand_group_code: string }) => ({
        code: s.code, name: s.name, demand_group_code: s.demand_group_code,
      }));
      if (sbSubs) {
        const codes = new Set(subs.map((s) => s.code));
        for (const r of sbSubs) {
          if (!codes.has(r.code)) subs.push({ code: r.code, name: r.name, demand_group_code: r.demand_group_code });
        }
      }
      setAllSubGroups(subs);
    })();
    return () => { cancelled = true; };
  }, []);

  const subGroupOptions = useMemo(
    () => demandGroup ? allSubGroups.filter((sg) => sg.demand_group_code === demandGroup) : [],
    [demandGroup, allSubGroups],
  );

  useEffect(() => {
    if (!demandGroup || !subGroupOptions.some((sg) => sg.code === demandSubGroup)) {
      setDemandSubGroup("");
    }
  }, [demandGroup, demandSubGroup, subGroupOptions]);

  useEffect(() => {
    return () => {
      if (frontPhoto) URL.revokeObjectURL(frontPhoto.previewUrl);
      if (priceTagPhoto) URL.revokeObjectURL(priceTagPhoto.previewUrl);
      extraPhotos.forEach((sp) => URL.revokeObjectURL(sp.previewUrl));
    };
  }, [frontPhoto, priceTagPhoto, extraPhotos]);

  const mergeExtracted = useCallback(
    (data: Record<string, unknown>) => {
      const trySet = (key: string, value: unknown) => {
        if (value == null || value === "") return;
        const str = typeof value === "number" ? String(value) : String(value).trim();
        if (!str) return;
        switch (key) {
          case "name": if (!name.trim()) setName(str); break;
          case "brand": if (!brand.trim()) setBrand(str); break;
          case "price": if (!price.trim() && typeof value === "number") setPrice(String(value)); break;
          case "ean_barcode": if (!ean.trim()) setEan(str); break;
          case "article_number": if (!articleNumber.trim()) setArticleNumber(str); break;
          case "weight_or_quantity": if (!weightOrQuantity.trim()) setWeightOrQuantity(str); break;
          case "demand_group_code": if (!demandGroup.trim()) setDemandGroup(str); break;
          case "demand_sub_group": if (!demandSubGroup.trim()) setDemandSubGroup(str); break;
          case "ingredients": if (!ingredients.trim()) setIngredients(str); break;
          case "allergens": if (!allergens.trim()) setAllergens(str); break;
          default: break;
        }
      };
      Object.entries(data).forEach(([k, v]) => trySet(k, v));
    },
    [name, brand, price, ean, articleNumber, weightOrQuantity, demandGroup, demandSubGroup, ingredients, allergens],
  );

  const analyzeAllPhotos = useCallback(async () => {
    const allSlotPhotos: { file: File; purpose: PhotoSlotPurpose }[] = [];
    if (frontPhoto) allSlotPhotos.push({ file: frontPhoto.file, purpose: "front" });
    if (priceTagPhoto) allSlotPhotos.push({ file: priceTagPhoto.file, purpose: "price_tag" });
    for (const sp of extraPhotos) allSlotPhotos.push({ file: sp.file, purpose: "extra" });

    if (allSlotPhotos.length === 0) return;

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    setAnalyzing(true);
    setSaveError(null);

    try {
      const images = await Promise.all(
        allSlotPhotos.map(async ({ file }) => {
          const { base64, mediaType } = await compressImage(file);
          return { image_base64: base64, media_type: mediaType };
        }),
      );

      const totalBytes = images.reduce((sum, img) => sum + img.image_base64.length, 0);
      if (totalBytes > MAX_TOTAL_BASE64_BYTES) {
        throw new Error(`Bilder sind zu groß (${(totalBytes / 1_000_000).toFixed(1)} MB). Bitte weniger oder kleinere Fotos verwenden.`);
      }

      const photo_roles = allSlotPhotos.map((sp) => sp.purpose);

      const res = await fetch("/api/analyze-product-photos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images, photo_roles }),
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

      if (Array.isArray(data.gallery_photos) && data.gallery_photos.length > 0) {
        const gp: ProcessedGalleryPhotoClient[] = data.gallery_photos.map(
          (p: { image_base64: string; format: string; category: "product" | "price_tag" }) => ({
            dataUrl: `data:${p.format};base64,${p.image_base64}`,
            format: p.format,
            category: p.category,
          }),
        );
        setProcessedGalleryPhotos(gp);
      }

      const extracted = data.extracted_data as Record<string, unknown> | undefined;
      if (extracted) mergeExtracted(extracted);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      log.error("[useProductCreation] analysis failed:", err);
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setAnalyzing(false);
    }
  }, [frontPhoto, priceTagPhoto, extraPhotos, mergeExtracted]);

  const makeSlotPhoto = useCallback((file: File, purpose: PhotoSlotPurpose): SlotPhoto => ({
    purpose,
    file,
    previewUrl: URL.createObjectURL(file),
  }), []);

  const onFrontSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (frontPhoto) URL.revokeObjectURL(frontPhoto.previewUrl);
    setProcessedThumbnail(null);
    setThumbnailType(null);
    const sp = makeSlotPhoto(file, "front");
    setFrontPhoto(sp);
    e.target.value = "";
  }, [frontPhoto, makeSlotPhoto]);

  const onPriceTagSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (priceTagPhoto) URL.revokeObjectURL(priceTagPhoto.previewUrl);
    const sp = makeSlotPhoto(file, "price_tag");
    setPriceTagPhoto(sp);
    e.target.value = "";
  }, [priceTagPhoto, makeSlotPhoto]);

  const onExtraSelected = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    const newPhotos = files.map((f) => makeSlotPhoto(f, "extra"));
    setExtraPhotos((prev) => [...prev, ...newPhotos]);
    e.target.value = "";
  }, [makeSlotPhoto]);

  const removeFront = useCallback(() => {
    if (frontPhoto) URL.revokeObjectURL(frontPhoto.previewUrl);
    setFrontPhoto(null);
    setProcessedThumbnail(null);
    setThumbnailType(null);
    setProcessedGalleryPhotos([]);
  }, [frontPhoto]);

  const removePriceTag = useCallback(() => {
    if (priceTagPhoto) URL.revokeObjectURL(priceTagPhoto.previewUrl);
    setPriceTagPhoto(null);
  }, [priceTagPhoto]);

  const removeExtra = useCallback((index: number) => {
    setExtraPhotos((prev) => {
      if (prev[index]) URL.revokeObjectURL(prev[index].previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  const rotateFront = useCallback(async () => {
    if (!frontPhoto) return;
    const { file, previewUrl } = await rotateImageFile(frontPhoto.file);
    URL.revokeObjectURL(frontPhoto.previewUrl);
    setFrontPhoto({ purpose: "front", file, previewUrl });
    setProcessedThumbnail(null);
    setThumbnailType(null);
    setProcessedGalleryPhotos([]);
  }, [frontPhoto]);

  const rotatePriceTag = useCallback(async () => {
    if (!priceTagPhoto) return;
    const { file, previewUrl } = await rotateImageFile(priceTagPhoto.file);
    URL.revokeObjectURL(priceTagPhoto.previewUrl);
    setPriceTagPhoto({ purpose: "price_tag", file, previewUrl });
  }, [priceTagPhoto]);

  const rotateExtra = useCallback(async (index: number) => {
    setExtraPhotos((prev) => {
      const target = prev[index];
      if (!target) return prev;
      rotateImageFile(target.file).then(({ file, previewUrl }) => {
        URL.revokeObjectURL(target.previewUrl);
        setExtraPhotos((curr) =>
          curr.map((sp, i) => i === index ? { purpose: "extra", file, previewUrl } : sp),
        );
      });
      return prev;
    });
  }, []);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setSaveError("Bitte Name eingeben.");
      return;
    }
    setSaveError(null);
    setDuplicateProductId(null);
    setSaving(true);

    try {
      const body: Record<string, unknown> = {
        name: name.trim(),
        brand: brand.trim() || null,
        price: price.trim() ? Number(price) : null,
        ean_barcode: ean.trim() || null,
        article_number: articleNumber.trim() || null,
        weight_or_quantity: weightOrQuantity.trim() || null,
        demand_group_code: demandGroup.trim() || null,
        demand_sub_group: demandSubGroup.trim() || null,
        ingredients: ingredients.trim() || null,
        allergens: allergens.trim() || null,
        assortment_type: assortmentType,
        thumbnail_base64: processedThumbnail?.startsWith("data:")
          ? processedThumbnail.split(",")[1] ?? null : null,
        thumbnail_format: processedThumbnail?.startsWith("data:")
          ? (processedThumbnail.match(/data:(image\/[^;]+);/)?.[1] ?? "image/jpeg") : null,
      };
      if (duplicateProductId) body.update_existing_product_id = duplicateProductId;

      if (processedGalleryPhotos.length > 0) {
        body.gallery_photos = processedGalleryPhotos.map((gp) => ({
          image_base64: gp.dataUrl.split(",")[1] ?? "",
          format: gp.format,
          category: gp.category,
        }));
      }

      const res = await fetch("/api/products/create-manual", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();

      if (res.ok && json.duplicate && json.existing_product_id && !duplicateProductId) {
        setDuplicateProductId(json.existing_product_id);
        setSaving(false);
        return;
      }
      if (!res.ok) {
        setSaveError(json.error ?? "Speichern fehlgeschlagen");
        setSaving(false);
        return;
      }

      setSaving(false);
      resetForm();
      onSaved?.();
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Speichern fehlgeschlagen";
      log.error("[useProductCreation] save failed:", e);
      setSaveError(msg);
      setSaving(false);
    }
  }, [
    name, brand, price, ean, articleNumber, weightOrQuantity,
    demandGroup, demandSubGroup, ingredients, allergens, assortmentType,
    processedThumbnail, processedGalleryPhotos,
    duplicateProductId, resetForm, onSaved, onClose,
  ]);

  const handleClose = useCallback(() => {
    if (saving) return;
    abortControllerRef.current?.abort();
    setDuplicateProductId(null);
    setSaveError(null);
    onClose();
  }, [saving, onClose]);

  const fields: ProductFormFields = {
    name, brand, price, ean, articleNumber, weightOrQuantity,
    demandGroup, demandSubGroup, ingredients, allergens, assortmentType,
  };

  const setters = {
    setName, setBrand, setPrice, setEan, setArticleNumber, setWeightOrQuantity,
    setDemandGroup, setDemandSubGroup, setIngredients, setAllergens, setAssortmentType,
  };

  return {
    fields, setters,
    demandGroupOptions, subGroupOptions,
    frontPhoto, priceTagPhoto, extraPhotos,
    processedThumbnail, thumbnailType, processedGalleryPhotos,
    analyzing, saving, saveError,
    duplicateProductId, setDuplicateProductId,
    fileInputFrontRef, fileInputPriceRef, fileInputExtraRef,
    onFrontSelected, onPriceTagSelected, onExtraSelected,
    removeFront, removePriceTag, removeExtra,
    rotateFront, rotatePriceTag, rotateExtra,
    analyzeAllPhotos,
    handleSave, handleClose,
  };
}
