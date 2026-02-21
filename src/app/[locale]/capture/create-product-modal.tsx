"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { DEMAND_GROUPS_LIST } from "@/lib/products/demand-groups-list";
import { getDeviceUserId } from "@/lib/list/device-id";

const BUCKET = "product-photos";

function generateId(): string {
  return typeof crypto !== "undefined" && crypto.randomUUID
    ? crypto.randomUUID()
    : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
      });
}

type DataPhotoStatus = "uploading" | "processing" | "done" | "error";

interface DataPhotoItem {
  id: string;
  status: DataPhotoStatus;
  fieldsRecognized?: number;
  error?: string;
  uploadId?: string;
}

interface CreateProductModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function CreateProductModal({ open, onClose, onSaved }: CreateProductModalProps) {
  const t = useTranslations("capture.createProduct");
  const tReview = useTranslations("capture.review");

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

  const [thumbnailBlob, setThumbnailBlob] = useState<Blob | null>(null);
  const [thumbnailPreview, setThumbnailPreview] = useState<string | null>(null);
  /** upload_id von der Erkennung (Thumbnail wird auch ausgewertet) für data_upload_ids beim Speichern */
  const [thumbnailExtractionUploadId, setThumbnailExtractionUploadId] = useState<string | null>(null);
  const [extraBlobs, setExtraBlobs] = useState<Array<{ id: string; blob: Blob; url: string; uploadId?: string }>>([]);
  const [dataPhotos, setDataPhotos] = useState<DataPhotoItem[]>([]);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [duplicateProductId, setDuplicateProductId] = useState<string | null>(null);
  /** Welches Foto-Auswahlmenü ist offen: thumb | extra | data. null = zu. */
  const [photoSourceMenu, setPhotoSourceMenu] = useState<"thumb" | "extra" | "data" | null>(null);
  /** Kamera-Overlay: für welchen Bereich. Wenn gesetzt, wird Kamera mit Vorschau + Aufnahme-Button gezeigt. */
  const [cameraFor, setCameraFor] = useState<"thumb" | "extra" | "data" | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const fileInputThumb = useRef<HTMLInputElement>(null);
  const fileInputExtra = useRef<HTMLInputElement>(null);
  const fileInputData = useRef<HTMLInputElement>(null);

  const subGroupOptions = demandGroup
    ? DEMAND_GROUPS_LIST.find((g) => g.group === demandGroup)?.subGroups ?? []
    : [];

  useEffect(() => {
    if (!demandGroup || !subGroupOptions.includes(demandSubGroup)) {
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
          case "demand_group":
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
    [
      name,
      brand,
      price,
      ean,
      articleNumber,
      weightOrQuantity,
      demandGroup,
      demandSubGroup,
      ingredients,
      allergens,
    ]
  );

  /** Lädt Blob hoch, startet Erkennung, merged in Formular. Gibt upload_id zurück (für data_upload_ids). */
  const runExtractionForBlob = useCallback(
    async (blob: Blob): Promise<string | null> => {
      const uploadId = generateId();
      const supabase = createClientIfConfigured();
      if (!supabase) return null;

      const ext = blob.type === "image/png" ? "png" : "jpg";
      const path = `${getDeviceUserId()}/manual/data_${uploadId}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, blob, {
        contentType: blob.type,
        upsert: false,
      });
      if (upErr) return null;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const photoUrl = urlData.publicUrl;

      await supabase.from("photo_uploads").insert({
        upload_id: uploadId,
        user_id: getDeviceUserId(),
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
      const path = `${getDeviceUserId()}/manual/data_${uploadId}.${ext}`;
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
        user_id: getDeviceUserId(),
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

  useEffect(() => {
    if (!cameraFor) {
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
      return;
    }
    let mounted = true;
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" }, audio: false })
      .then((stream) => {
        if (!mounted) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        const video = cameraVideoRef.current;
        if (video) {
          video.srcObject = stream;
          video.play().catch(() => {});
        }
      })
      .catch((e) => {
        console.error("Camera error:", e);
        if (mounted) setCameraFor(null);
      });
    return () => {
      mounted = false;
      cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraFor]);

  const captureFromCamera = useCallback(() => {
    const video = cameraVideoRef.current;
    const stream = cameraStreamRef.current;
    const forSection = cameraFor;
    if (!video || !stream || !forSection || video.readyState < 2) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    stream.getTracks().forEach((t) => t.stop());
    cameraStreamRef.current = null;
    setCameraFor(null);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        if (forSection === "thumb") {
          setThumbnailPreview((prev) => {
            if (prev) URL.revokeObjectURL(prev);
            return URL.createObjectURL(blob);
          });
          setThumbnailBlob(blob);
          setThumbnailExtractionUploadId(null);
          runExtractionForBlob(blob).then((id) => id && setThumbnailExtractionUploadId(id));
        } else if (forSection === "extra") {
          const id = generateId();
          setExtraBlobs((prev) => [...prev, { id, blob, url: URL.createObjectURL(blob) }]);
          runExtractionForBlob(blob).then((uploadId) => {
            if (uploadId)
              setExtraBlobs((prev) =>
                prev.map((e) => (e.id === id ? { ...e, uploadId } : e))
              );
          });
        } else if (forSection === "data") {
          addDataPhoto(blob);
        }
      },
      "image/jpeg",
      0.9
    );
  }, [cameraFor, runExtractionForBlob, addDataPhoto]);

  const openCameraFor = useCallback((section: "thumb" | "extra" | "data") => {
    setPhotoSourceMenu(null);
    setCameraFor(section);
  }, []);

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
      const path = `${getDeviceUserId()}/manual/thumb_${tid}.jpg`;
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
      const path = `${getDeviceUserId()}/manual/extra_${item.id}.jpg`;
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
      demand_group: demandGroup.trim() || null,
      demand_sub_group: demandSubGroup.trim() || null,
      ingredients: ingredients.trim() || null,
      allergens: allergens.trim() || null,
      thumbnail_url: thumbnailUrl,
      extra_photo_urls: extraUrls,
      data_upload_ids: dataUploadIds,
      user_id: getDeviceUserId(),
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
    onSaved?.();
    onClose();
  }, [
    name,
    brand,
    price,
    ean,
    articleNumber,
    weightOrQuantity,
    demandGroup,
    demandSubGroup,
    ingredients,
    allergens,
    thumbnailBlob,
    thumbnailExtractionUploadId,
    extraBlobs,
    dataPhotos,
    duplicateProductId,
    onSaved,
    onClose,
  ]);

  const handleClose = useCallback(() => {
    if (saving) return;
    setDuplicateProductId(null);
    setSaveError(null);
    onClose();
  }, [saving, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white">
      <header className="flex shrink-0 items-center justify-between border-b border-aldi-muted-light bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-aldi-blue">{t("title")}</h1>
        <button
          type="button"
          onClick={handleClose}
          disabled={saving}
          className="rounded-lg px-2 py-1 text-aldi-blue transition-colors hover:bg-aldi-muted-light/50 disabled:opacity-50"
          aria-label={t("cancel")}
        >
          {t("cancel")}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto grid max-w-lg gap-4">
          <section className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-xs font-medium text-aldi-muted">{tReview("name")}</span>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-aldi-muted">{tReview("brand")}</span>
              <input
                type="text"
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-aldi-muted">{tReview("price")}</span>
              <input
                type="text"
                inputMode="decimal"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-aldi-muted">{tReview("ean")}</span>
              <input
                type="text"
                value={ean}
                onChange={(e) => setEan(e.target.value)}
                className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-aldi-muted">{tReview("articleNumber")}</span>
              <input
                type="text"
                value={articleNumber}
                onChange={(e) => setArticleNumber(e.target.value)}
                className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-aldi-muted">{tReview("weightOrQuantity")}</span>
              <input
                type="text"
                value={weightOrQuantity}
                onChange={(e) => setWeightOrQuantity(e.target.value)}
                className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
              />
            </label>
            <label className="grid gap-1">
              <span className="text-xs font-medium text-aldi-muted">{t("demandGroup")}</span>
              <select
                value={demandGroup}
                onChange={(e) => setDemandGroup(e.target.value)}
                className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
              >
                <option value="">—</option>
                {DEMAND_GROUPS_LIST.map((g) => (
                  <option key={g.group} value={g.group}>
                    {g.group}
                  </option>
                ))}
              </select>
            </label>
            {subGroupOptions.length > 0 && (
              <label className="grid gap-1">
                <span className="text-xs font-medium text-aldi-muted">{t("demandSubGroup")}</span>
                <select
                  value={demandSubGroup}
                  onChange={(e) => setDemandSubGroup(e.target.value)}
                  className="rounded-lg border border-aldi-muted-light px-3 py-2 text-aldi-text"
                >
                  <option value="">—</option>
                  {subGroupOptions.map((sg) => (
                    <option key={sg} value={sg}>
                      {sg}
                    </option>
                  ))}
                </select>
              </label>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-aldi-text">{t("photoThumbnail")}</h2>
            <button
              type="button"
              onClick={() => setPhotoSourceMenu("thumb")}
              className="rounded-xl border-2 border-aldi-blue bg-white px-4 py-2 text-aldi-blue"
            >
              {t("photoButton")}
            </button>
            <input ref={fileInputThumb} type="file" className="hidden" accept="image/*" />
            {thumbnailPreview && (
              <div className="mt-2">
                <img
                  src={thumbnailPreview}
                  alt=""
                  className="h-24 w-24 rounded-lg object-cover"
                />
              </div>
            )}
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-aldi-text">{t("extraPhotos")}</h2>
            <button
              type="button"
              onClick={() => setPhotoSourceMenu("extra")}
              className="rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 text-aldi-text"
            >
              {t("photoButton")}
            </button>
            <input ref={fileInputExtra} type="file" className="hidden" accept="image/*" multiple />
            <div className="mt-2 flex flex-wrap gap-2">
              {extraBlobs.map((item) => (
                <div key={item.id} className="relative">
                  <img
                    src={item.url}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => removeExtra(item.id)}
                    className="absolute -right-1 -top-1 rounded-full bg-red-500 p-0.5 text-white"
                    aria-label="Entfernen"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="mb-2 text-sm font-semibold text-aldi-text">{t("dataPhotos")}</h2>
            <button
              type="button"
              onClick={() => setPhotoSourceMenu("data")}
              className="rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-2 text-aldi-text"
            >
              {t("photoButton")}
            </button>
            <input ref={fileInputData} type="file" className="hidden" accept="image/*" multiple />
            <ul className="mt-2 list-none space-y-1 text-sm text-aldi-muted">
              {dataPhotos.map((d) => (
                <li key={d.id}>
                  {d.status === "uploading" && t("statusUploading")}
                  {d.status === "processing" && t("statusProcessing")}
                  {d.status === "done" && t("statusDone", { count: d.fieldsRecognized ?? 0 })}
                  {d.status === "error" && `Fehler: ${d.error}`}
                </li>
              ))}
            </ul>
          </section>

          {saveError && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-600">{saveError}</p>
          )}
          {duplicateProductId && (
            <div className="rounded-lg border border-aldi-muted-light bg-aldi-muted-light/30 p-3">
              <p className="font-medium text-aldi-text">{t("duplicateTitle")}</p>
              <p className="text-sm text-aldi-muted">{t("duplicateMessage")}</p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => handleSave()}
                  className="rounded-xl bg-aldi-blue px-4 py-2 text-white"
                >
                  {t("update")}
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateProductId(null)}
                  className="rounded-xl border border-aldi-muted-light px-4 py-2 text-aldi-text"
                >
                  {t("dontUpdate")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="shrink-0 border-t border-aldi-muted-light bg-white p-4">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !name.trim()}
          className="w-full rounded-xl bg-aldi-blue px-4 py-3 font-medium text-white transition-opacity disabled:opacity-50"
        >
          {saving ? "…" : t("save")}
        </button>
      </footer>

      {photoSourceMenu !== null && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setPhotoSourceMenu(null)}
          role="dialog"
          aria-label={t("photoButton")}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl bg-white p-4 shadow-lg sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="mb-3 text-sm font-medium text-aldi-muted">
              {photoSourceMenu === "thumb" && t("photoThumbnail")}
              {photoSourceMenu === "extra" && t("extraPhotos")}
              {photoSourceMenu === "data" && t("dataPhotos")}
            </p>
            <div className="flex flex-col gap-2">
              <button
                type="button"
                className="rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-left text-aldi-text"
                onClick={() => {
                  if (photoSourceMenu === "thumb") pickThumbnail();
                  if (photoSourceMenu === "extra") pickExtra();
                  if (photoSourceMenu === "data") pickDataPhoto();
                  setPhotoSourceMenu(null);
                }}
              >
                {t("photoLibrary")}
              </button>
              <button
                type="button"
                className="rounded-xl border-2 border-aldi-blue bg-white px-4 py-3 text-left text-aldi-blue"
                onClick={() => {
                  if (photoSourceMenu === "thumb") openCameraFor("thumb");
                  if (photoSourceMenu === "extra") openCameraFor("extra");
                  if (photoSourceMenu === "data") openCameraFor("data");
                }}
              >
                {t("takePhoto")}
              </button>
            </div>
            <button
              type="button"
              className="mt-3 w-full rounded-xl border border-aldi-muted-light py-2 text-sm text-aldi-muted"
              onClick={() => setPhotoSourceMenu(null)}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}

      {cameraFor !== null && (
        <div className="fixed inset-0 z-[70] flex flex-col bg-black">
          <video
            ref={cameraVideoRef}
            autoPlay
            playsInline
            muted
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-x-0 bottom-0 flex justify-center gap-4 bg-gradient-to-t from-black/80 to-transparent p-6 pb-8">
            <button
              type="button"
              className="rounded-full bg-white/90 px-8 py-4 font-medium text-aldi-text shadow-lg"
              onClick={captureFromCamera}
            >
              {t("captureButton")}
            </button>
            <button
              type="button"
              className="rounded-full border-2 border-white/90 px-6 py-3 text-white"
              onClick={() => {
                cameraStreamRef.current?.getTracks().forEach((t) => t.stop());
                cameraStreamRef.current = null;
                setCameraFor(null);
              }}
            >
              {t("cancel")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
