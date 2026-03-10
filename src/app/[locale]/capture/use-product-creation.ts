"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { db } from "@/lib/db";
import { fetchDemandGroupsFromSupabase, fetchDemandSubGroupsFromSupabase } from "@/lib/categories/category-service";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import { generateId } from "@/lib/utils/generate-id";

const BUCKET = "product-photos";

export type DataPhotoStatus = "uploading" | "processing" | "done" | "error";

export interface DataPhotoItem {
  id: string;
  status: DataPhotoStatus;
  fieldsRecognized?: number;
  error?: string;
  uploadId?: string;
}

export interface ExtraBlobItem {
  id: string;
  blob: Blob;
  url: string;
  uploadId?: string;
}

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

  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  const [thumbnailExtractionUploadId, setThumbnailExtractionUploadId] = useState<string | null>(null);
  const [extraBlobs, setExtraBlobs] = useState<ExtraBlobItem[]>([]);
  const [dataPhotos, setDataPhotos] = useState<DataPhotoItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicateProductId, setDuplicateProductId] = useState<string | null>(null);

  const fileInputThumb = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const fileInputExtra = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;
  const fileInputData = useRef<HTMLInputElement>(null) as React.RefObject<HTMLInputElement>;

  const resetForm = useCallback(() => {
    setName("");
    setBrand("");
    setPrice("");
    setEan("");
    setArticleNumber("");
    setWeightOrQuantity("");
    setDemandGroup("");
    setDemandSubGroup("");
    setIngredients("");
    setAllergens("");
    setAssortmentType("daily_range");
    if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
    setThumbnailBlob(null);
    setThumbnailPreview(null);
    setThumbnailExtractionUploadId(null);
    extraBlobs.forEach((e) => URL.revokeObjectURL(e.url));
    setExtraBlobs([]);
    setDataPhotos([]);
    setSaving(false);
    setSaveError(null);
    setDuplicateProductId(null);
  }, [thumbnailPreview, extraBlobs]);

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
      const dsgTable = "demand_sub_groups" in db ? (db as unknown as Record<string, { toArray: () => Promise<SgOption[]> }>).demand_sub_groups : null;
      const [idbGroups, sbGroups, idbSubs, sbSubs] = await Promise.all([
        db.demand_groups.toArray(),
        fetchDemandGroupsFromSupabase(),
        dsgTable ? dsgTable.toArray().catch(() => [] as SgOption[]) : Promise.resolve([] as SgOption[]),
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
    () => demandGroup
      ? allSubGroups.filter((sg) => sg.demand_group_code === demandGroup)
      : [],
    [demandGroup, allSubGroups],
  );

  useEffect(() => {
    if (!demandGroup || !subGroupOptions.some((sg) => sg.code === demandSubGroup)) {
      setDemandSubGroup("");
    }
  }, [demandGroup, demandSubGroup, subGroupOptions]);

  useEffect(() => {
    return () => {
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
      extraBlobs.forEach((e) => URL.revokeObjectURL(e.url));
    };
  }, [thumbnailPreview, extraBlobs]);

  const mergeExtracted = useCallback(
    (data: Record<string, unknown>) => {
      const set = (key: keyof typeof data, value: unknown) => {
        if (value == null || value === "") return;
        const str = typeof value === "number" ? String(value) : String(value).trim();
        if (!str) return;
        switch (key) {
          case "name":
            if (!name.trim()) setName(str);
            break;
          case "brand":
            if (!brand.trim()) setBrand(str);
            break;
          case "price":
            if (!price.trim() && typeof value === "number") setPrice(String(value));
            break;
          case "ean_barcode":
            if (!ean.trim()) setEan(str);
            break;
          case "article_number":
            if (!articleNumber.trim()) setArticleNumber(str);
            break;
          case "weight_or_quantity":
            if (!weightOrQuantity.trim()) setWeightOrQuantity(str);
            break;
          case "demand_group_code":
            if (!demandGroup.trim()) setDemandGroup(str);
            break;
          case "demand_sub_group":
            if (!demandSubGroup.trim()) setDemandSubGroup(str);
            break;
          case "ingredients":
            if (!ingredients.trim()) setIngredients(str);
            break;
          case "allergens":
            if (!allergens.trim()) setAllergens(str);
            break;
          default:
            break;
        }
      };
      Object.entries(data).forEach(([k, v]) => set(k as keyof typeof data, v));
    },
    [name, brand, price, ean, articleNumber, weightOrQuantity, demandGroup, demandSubGroup, ingredients, allergens]
  );

  const runExtractionForBlob = useCallback(
    async (blob: Blob): Promise<string | null> => {
      const uploadId = generateId();
      const supabase = createClientIfConfigured();
      if (!supabase) return null;

      const ext = blob.type === "image/png" ? "png" : "jpg";
      const path = `${getCurrentUserId()}/manual/data_${uploadId}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type,
        upsert: false,
      });
      if (upErr) return null;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      await supabase.from("photo_uploads").insert({
        upload_id: uploadId,
        user_id: getCurrentUserId(),
        photo_url: photoUrl,
        photo_type: "data_extraction",
        status: "processing",
        products_created: 0,
        products_updated: 0,
      });

      try {
        const res = await fetch("/api/process-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upload_id: uploadId, photo_url: photoUrl, data_extraction: true }),
        });
        const json = await res.json();
        if (!res.ok) return uploadId;
        const extracted = json.extracted_data as Record<string, unknown> | undefined;
        if (extracted) mergeExtracted(extracted);
        return uploadId;
      } catch {
        return uploadId;
      }
    },
    [mergeExtracted]
  );

  const addDataPhoto = useCallback(
    async (blob: Blob) => {
      const id = generateId();
      const uploadId = generateId();
      setDataPhotos((prev) => [...prev, { id, status: "uploading", uploadId }]);

      const supabase = createClientIfConfigured();
      if (!supabase) {
        setDataPhotos((p) => p.map((x) => (x.id === id ? { ...x, status: "error" as const, error: "Supabase nicht konfiguriert" } : x)));
        return;
      }

      const ext = blob.type === "image/png" ? "png" : "jpg";
      const path = `${getCurrentUserId()}/manual/data_${uploadId}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type,
        upsert: false,
      });
      if (upErr) {
        setDataPhotos((p) => p.map((x) => (x.id === id ? { ...x, status: "error" as const, error: upErr.message } : x)));
        return;
      }
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      setDataPhotos((p) => p.map((x) => (x.id === id ? { ...x, status: "processing" as const } : x)));

      const { data: insertErr } = await supabase.from("photo_uploads").insert({
        upload_id: uploadId,
        user_id: getCurrentUserId(),
        photo_url: photoUrl,
        photo_type: "data_extraction",
        status: "processing",
        products_created: 0,
        products_updated: 0,
      });
      if (insertErr) {
        setDataPhotos((p) => p.map((x) => (x.id === id ? { ...x, status: "error" as const, error: "DB insert failed" } : x)));
        return;
      }

      try {
        const res = await fetch("/api/process-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ upload_id: uploadId, photo_url: photoUrl, data_extraction: true }),
        });
        const json = await res.json();
        if (!res.ok) {
          setDataPhotos((p) =>
            p.map((x) => (x.id === id ? { ...x, status: "error" as const, error: json.error ?? "API error" } : x))
          );
          return;
        }
        const extracted = json.extracted_data as Record<string, unknown> | undefined;
        let count = 0;
        if (extracted) {
          count = Object.values(extracted).filter((v) => v != null && v !== "").length;
          mergeExtracted(extracted);
        }
        setDataPhotos((p) =>
          p.map((x) => (x.id === id ? { ...x, status: "done" as const, fieldsRecognized: count } : x))
        );
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Request failed";
        setDataPhotos((p) => p.map((x) => (x.id === id ? { ...x, status: "error" as const, error: msg } : x)));
      }
    },
    [mergeExtracted]
  );

  const pickThumbnail = useCallback(() => {
    const input = fileInputThumb.current;
    if (!input) return;
    input.accept = "image/*";
    input.removeAttribute("capture");
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      if (thumbnailPreview) URL.revokeObjectURL(thumbnailPreview);
      setThumbnailBlob(file);
      setThumbnailPreview(URL.createObjectURL(file));
      setThumbnailExtractionUploadId(null);
      input.value = "";
      runExtractionForBlob(file).then((id) => id && setThumbnailExtractionUploadId(id));
    };
    input.click();
  }, [thumbnailPreview, runExtractionForBlob]);

  const pickExtra = useCallback(() => {
    const input = fileInputExtra.current;
    if (!input) return;
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => {
      const files = input.files;
      if (!files?.length) return;
      const newOnes = Array.from(files).map((file) => ({
        id: generateId(),
        blob: file,
        url: URL.createObjectURL(file),
      }));
      setExtraBlobs((prev) => [...prev, ...newOnes]);
      input.value = "";
      newOnes.forEach((item) => {
        runExtractionForBlob(item.blob).then((uploadId) => {
          if (uploadId)
            setExtraBlobs((prev) =>
              prev.map((e) => (e.id === item.id ? { ...e, uploadId } : e))
            );
        });
      });
    };
    input.click();
  }, [runExtractionForBlob]);

  const removeExtra = useCallback((id: string) => {
    setExtraBlobs((prev) => {
      const item = prev.find((e) => e.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return prev.filter((e) => e.id !== id);
    });
  }, []);

  const pickDataPhoto = useCallback(() => {
    const input = fileInputData.current;
    if (!input) return;
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = () => {
      const files = input.files;
      if (!files?.length) return;
      Array.from(files).forEach((file) => addDataPhoto(file));
      input.value = "";
    };
    input.click();
  }, [addDataPhoto]);

  const handleSave = useCallback(async () => {
    if (!name.trim()) {
      setSaveError("Bitte Name eingeben.");
      return;
    }
    setSaveError(null);
    setDuplicateProductId(null);
    setSaving(true);

    const supabase = createClientIfConfigured();
    if (!supabase) {
      setSaveError("Supabase nicht konfiguriert.");
      setSaving(false);
      return;
    }

    let thumbnailUrl: string | null = null;
    if (thumbnailBlob) {
      const tid = generateId();
      const path = `${getCurrentUserId()}/manual/thumb_${tid}.jpg`;
      const { error: te } = await supabase.storage.from(BUCKET).upload(path, thumbnailBlob, {
        contentType: "image/jpeg",
        upsert: false,
      });
      if (!te) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        thumbnailUrl = urlData.publicUrl;
      }
    }

    const extraUrls: string[] = [];
    for (const item of extraBlobs) {
      const path = `${getCurrentUserId()}/manual/extra_${item.id}.jpg`;
      const { error: ee } = await supabase.storage.from(BUCKET).upload(path, item.blob, {
        contentType: item.blob.type || "image/jpeg",
        upsert: false,
      });
      if (!ee) {
        const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
        extraUrls.push(urlData.publicUrl);
      }
    }

    const dataUploadIds = [
      ...(thumbnailExtractionUploadId ? [thumbnailExtractionUploadId] : []),
      ...extraBlobs.map((e) => e.uploadId).filter(Boolean) as string[],
      ...dataPhotos
        .filter((d) => d.status === "done" && d.uploadId)
        .map((d) => d.uploadId as string),
    ];

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
      thumbnail_url: thumbnailUrl,
      extra_photo_urls: extraUrls,
      data_upload_ids: dataUploadIds,
    };
    if (duplicateProductId) body.update_existing_product_id = duplicateProductId;

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
  }, [
    name, brand, price, ean, articleNumber, weightOrQuantity,
    demandGroup, demandSubGroup, ingredients, allergens, assortmentType,
    thumbnailBlob, thumbnailExtractionUploadId, extraBlobs, dataPhotos,
    duplicateProductId, resetForm, onSaved, onClose,
  ]);

  const handleClose = useCallback(() => {
    if (saving) return;
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
    fields,
    setters,
    demandGroupOptions,
    subGroupOptions,
    thumbnailPreview,
    extraBlobs,
    dataPhotos,
    saving,
    saveError,
    duplicateProductId,
    setDuplicateProductId,
    fileInputThumb,
    fileInputExtra,
    fileInputData,
    pickThumbnail,
    pickExtra,
    removeExtra,
    pickDataPhoto,
    handleSave,
    handleClose,
  };
}
