"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import type { BBox, ProductRow } from "@/lib/flyers/flyer-service";
import { Tooltip } from "@/components/common/tooltip";

export interface Hotspot {
  product: ProductRow;
  bbox: BBox;
}

interface FlyerPageImageProps {
  imageUrl: string;
  className?: string;
  alt?: string;
  hotspots?: Hotspot[];
  onHotspotTap?: (product: ProductRow) => void;
  productIdsOnList?: Set<string>;
}

const blobCache = new Map<string, string>();

/**
 * Renders a flyer page lazily with memory management.
 * PDFs are rendered once to a temporary canvas, converted to a blob URL,
 * then the PDF document and canvas are freed immediately. The blob URL
 * is cached so re-scrolling reuses the image without re-fetching.
 * Supports pinch-to-zoom, pan, and double-tap to reset.
 */
const MIN_HOTSPOT_SIZE = 80; // bbox units (0-1000); ~8% of page dimension

export function FlyerPageImage({
  imageUrl,
  className,
  alt = "",
  hotspots,
  onHotspotTap,
  productIdsOnList,
}: FlyerPageImageProps) {
  const t = useTranslations("flyer");
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [visible, setVisible] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [measuredHeight, setMeasuredHeight] = useState(200);
  const [blobUrl, setBlobUrl] = useState<string | null>(() => blobCache.get(imageUrl) ?? null);

  const isPdf = imageUrl.toLowerCase().endsWith(".pdf");

  // Zoom state (refs to avoid re-renders during gesture)
  const scaleRef = useRef(1);
  const translateRef = useRef({ x: 0, y: 0 });
  const transformElRef = useRef<HTMLDivElement>(null);
  const [isZoomed, setIsZoomed] = useState(false);
  const pinchRef = useRef({
    initialDistance: 0,
    initialScale: 1,
    isPinching: false,
    panStartX: 0,
    panStartY: 0,
    panStartTranslateX: 0,
    panStartTranslateY: 0,
    isPanning: false,
    lastTapTime: 0,
  });

  const applyTransform = useCallback((animated = false) => {
    const el = transformElRef.current;
    if (!el) return;
    const s = scaleRef.current;
    const t = translateRef.current;
    el.style.transition = animated ? "transform 0.2s ease-out" : "none";
    el.style.transform = `translate(${t.x}px, ${t.y}px) scale(${s})`;
    setIsZoomed(s > 1);
  }, []);

  const getTouchDistance = (t1: Touch, t2: Touch) =>
    Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

  const clampTranslate = useCallback(
    (tx: number, ty: number, s: number) => {
      if (s <= 1) return { x: 0, y: 0 };
      const el = containerRef.current;
      if (!el) return { x: tx, y: ty };
      const rect = el.getBoundingClientRect();
      const maxX = (rect.width * (s - 1)) / 2;
      const maxY = (rect.height * (s - 1)) / 2;
      return {
        x: Math.max(-maxX, Math.min(maxX, tx)),
        y: Math.max(-maxY, Math.min(maxY, ty)),
      };
    },
    []
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      const p = pinchRef.current;
      if (e.touches.length === 2) {
        e.preventDefault();
        p.isPinching = true;
        p.isPanning = false;
        p.initialDistance = getTouchDistance(e.touches[0], e.touches[1]);
        p.initialScale = scaleRef.current;
      } else if (e.touches.length === 1 && scaleRef.current > 1) {
        p.isPanning = true;
        p.isPinching = false;
        p.panStartX = e.touches[0].clientX;
        p.panStartY = e.touches[0].clientY;
        p.panStartTranslateX = translateRef.current.x;
        p.panStartTranslateY = translateRef.current.y;
      }
      if (e.touches.length === 1) {
        const now = Date.now();
        if (now - p.lastTapTime < 300) {
          e.preventDefault();
          scaleRef.current = 1;
          translateRef.current = { x: 0, y: 0 };
          applyTransform(true);
          p.lastTapTime = 0;
        } else {
          p.lastTapTime = now;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      const p = pinchRef.current;
      if (p.isPinching && e.touches.length === 2) {
        e.preventDefault();
        const dist = getTouchDistance(e.touches[0], e.touches[1]);
        const newScale = Math.max(1, Math.min(4, p.initialScale * (dist / p.initialDistance)));
        scaleRef.current = newScale;
        if (newScale <= 1) translateRef.current = { x: 0, y: 0 };
        applyTransform();
      } else if (p.isPanning && e.touches.length === 1 && scaleRef.current > 1) {
        e.preventDefault();
        const dx = e.touches[0].clientX - p.panStartX;
        const dy = e.touches[0].clientY - p.panStartY;
        translateRef.current = clampTranslate(
          p.panStartTranslateX + dx,
          p.panStartTranslateY + dy,
          scaleRef.current
        );
        applyTransform();
      }
    };

    const onTouchEnd = () => {
      pinchRef.current.isPinching = false;
      pinchRef.current.isPanning = false;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: false });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd);

    // Mouse wheel zoom (pointer:fine devices)
    const onWheel = (e: WheelEvent) => {
      if (scaleRef.current <= 1 && !e.ctrlKey && !e.metaKey) return;
      e.preventDefault();
      const delta = -e.deltaY * 0.002;
      const newScale = Math.max(1, Math.min(4, scaleRef.current + delta));
      scaleRef.current = newScale;
      if (newScale <= 1) translateRef.current = { x: 0, y: 0 };
      else translateRef.current = clampTranslate(translateRef.current.x, translateRef.current.y, newScale);
      applyTransform();
    };

    // Mouse drag pan (when zoomed)
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let dragStartTx = 0;
    let dragStartTy = 0;

    const onMouseDown = (e: MouseEvent) => {
      if (scaleRef.current <= 1 || e.button !== 0) return;
      isDragging = true;
      dragStartX = e.clientX;
      dragStartY = e.clientY;
      dragStartTx = translateRef.current.x;
      dragStartTy = translateRef.current.y;
      el.style.cursor = "grabbing";
      e.preventDefault();
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      translateRef.current = clampTranslate(dragStartTx + dx, dragStartTy + dy, scaleRef.current);
      applyTransform();
    };

    const onMouseUp = () => {
      if (!isDragging) return;
      isDragging = false;
      el.style.cursor = scaleRef.current > 1 ? "grab" : "";
    };

    // Double-click to reset zoom
    const onDblClick = () => {
      scaleRef.current = 1;
      translateRef.current = { x: 0, y: 0 };
      applyTransform(true);
    };

    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("mousedown", onMouseDown);
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
    el.addEventListener("dblclick", onDblClick);

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("mousedown", onMouseDown);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      el.removeEventListener("dblclick", onDblClick);
    };
  }, [applyTransform, clampTranslate]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const isIntersecting = entries[0].isIntersecting;
        setVisible(isIntersecting);
      },
      { rootMargin: "200px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const onImgLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    setLoaded(true);
    const nw = e.currentTarget.naturalWidth;
    const nh = e.currentTarget.naturalHeight;
    setMeasuredHeight(nh / (nw / (containerRef.current?.clientWidth ?? 400)));
  }, []);

  // PDF → blob URL conversion (render once, cache, destroy PDF immediately)
  useEffect(() => {
    if (!isPdf || !visible) return;
    if (blobCache.has(imageUrl)) {
      if (!blobUrl) setBlobUrl(blobCache.get(imageUrl)!);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        if (!pdfjsLib.GlobalWorkerOptions?.workerSrc) {
          pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
        }
        const pdfResponse = await fetch(imageUrl);
        if (!pdfResponse.ok) throw new Error(`PDF fetch failed: ${pdfResponse.status}`);
        const pdfData = await pdfResponse.arrayBuffer();
        if (cancelled) return;

        const doc = await pdfjsLib.getDocument({ data: pdfData }).promise;
        if (cancelled) { doc.destroy(); return; }

        const page = await doc.getPage(1);
        if (cancelled) { doc.destroy(); return; }

        const dprScale = Math.min(window.devicePixelRatio ?? 1, 1.5);
        const viewport = page.getViewport({ scale: dprScale });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx || cancelled) { doc.destroy(); return; }

        await page.render({ canvasContext: ctx, viewport }).promise;

        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, "image/webp", 0.85)
        );

        canvas.width = 0;
        canvas.height = 0;
        page.cleanup();
        doc.destroy();

        if (cancelled || !blob) return;

        const url = URL.createObjectURL(blob);
        blobCache.set(imageUrl, url);
        if (!cancelled) {
          setBlobUrl(url);
          const containerWidth = containerRef.current?.clientWidth ?? 400;
          setMeasuredHeight(viewport.height / (viewport.width / containerWidth));
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : t("pdfLoadError"));
        }
      }
    })();

    return () => { cancelled = true; };
  }, [isPdf, visible, imageUrl, blobUrl, t]);

  const placeholder = (
    <div
      className="bg-aldi-muted-light/20"
      style={{ minHeight: loaded ? measuredHeight : 200 }}
    />
  );

  const [activeHotspot, setActiveHotspot] = useState<string | null>(null);

  const visibleHotspots = (hotspots ?? []).filter((h) => {
    const w = h.bbox.x_max - h.bbox.x_min;
    const hh = h.bbox.y_max - h.bbox.y_min;
    return w >= MIN_HOTSPOT_SIZE && hh >= MIN_HOTSPOT_SIZE;
  });

  const handleHotspotClick = useCallback(
    (h: Hotspot) => {
      if (activeHotspot === h.product.product_id) {
        onHotspotTap?.(h.product);
        setActiveHotspot(null);
      } else {
        setActiveHotspot(h.product.product_id);
      }
    },
    [activeHotspot, onHotspotTap],
  );

  useEffect(() => {
    if (!activeHotspot) return;
    const timer = setTimeout(() => setActiveHotspot(null), 4000);
    return () => clearTimeout(timer);
  }, [activeHotspot]);

  const imgSrc = isPdf ? blobUrl : imageUrl;
  const showImg = visible && imgSrc;

  const content = !visible ? (
    placeholder
  ) : error ? (
    <div className="flex flex-col items-center gap-2 bg-aldi-muted-light/20 px-4 py-6 text-center">
      <p className="text-sm text-aldi-muted">{t("pageLoadError")}</p>
      <a href={imageUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-aldi-blue underline">
        {t("openPdf")}
      </a>
    </div>
  ) : showImg ? (
    <Image
      src={imgSrc!}
      alt={alt}
      width={0}
      height={0}
      sizes="100vw"
      className={className}
      style={{ width: "100%", height: "auto" }}
      onLoad={onImgLoad}
      unoptimized
    />
  ) : (
    <div className="flex min-h-[200px] items-center justify-center bg-aldi-muted-light/20">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent" />
    </div>
  );

  const handleZoomIn = useCallback(() => {
    scaleRef.current = Math.min(4, scaleRef.current + 0.5);
    applyTransform(true);
  }, [applyTransform]);

  const handleZoomOut = useCallback(() => {
    const newScale = Math.max(1, scaleRef.current - 0.5);
    scaleRef.current = newScale;
    if (newScale <= 1) translateRef.current = { x: 0, y: 0 };
    applyTransform(true);
  }, [applyTransform]);

  const handleZoomReset = useCallback(() => {
    scaleRef.current = 1;
    translateRef.current = { x: 0, y: 0 };
    applyTransform(true);
  }, [applyTransform]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-hidden"
      style={{ touchAction: isZoomed ? "none" : "pan-y", cursor: isZoomed ? "grab" : undefined }}
    >
      {/* Zoom controls – visible on pointer:fine devices when image is loaded */}
      {loaded && (
        <div className="pointer-coarse:hidden absolute right-2 top-2 z-20 flex flex-col gap-1 rounded-lg bg-white/90 p-1 shadow-md">
          <Tooltip content={t("zoomIn")} position="bottom">
            <button
              type="button"
              onClick={handleZoomIn}
              className="flex h-8 w-8 items-center justify-center rounded text-aldi-text transition-colors hover:bg-aldi-muted-light"
              aria-label={t("zoomIn")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
            </button>
          </Tooltip>
          <Tooltip content={t("zoomOut")} position="bottom">
            <button
              type="button"
              onClick={handleZoomOut}
              className="flex h-8 w-8 items-center justify-center rounded text-aldi-text transition-colors hover:bg-aldi-muted-light"
              aria-label={t("zoomOut")}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" /></svg>
            </button>
          </Tooltip>
          {isZoomed && (
            <Tooltip content={t("zoomReset")} position="bottom">
              <button
                type="button"
                onClick={handleZoomReset}
                className="flex h-8 w-8 items-center justify-center rounded text-aldi-blue transition-colors hover:bg-aldi-blue/10"
                aria-label={t("zoomReset")}
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" /></svg>
              </button>
            </Tooltip>
          )}
        </div>
      )}
      <div ref={transformElRef} style={{ transformOrigin: "center center" }}>
        {content}

        {loaded && visibleHotspots.length > 0 && (
          <div className="pointer-events-none absolute inset-0">
            {visibleHotspots.map((h) => {
              const onList = productIdsOnList?.has(h.product.product_id);
              const isActive = activeHotspot === h.product.product_id;
              const left = h.bbox.x_min / 10;
              const top = h.bbox.y_min / 10;
              const width = (h.bbox.x_max - h.bbox.x_min) / 10;
              const height = (h.bbox.y_max - h.bbox.y_min) / 10;
              const displayPrice = h.product.price_in_flyer ?? h.product.price;

              return (
                <div key={h.product.product_id} style={{ position: "absolute", left: `${left}%`, top: `${top}%`, width: `${width}%`, height: `${height}%` }}>
                  <button
                    type="button"
                    className={`pointer-events-auto h-full w-full rounded transition-all ${
                      isActive
                        ? "border-2 border-aldi-blue bg-aldi-blue/10"
                        : onList
                          ? "border border-green-500/40"
                          : "border border-aldi-blue/20 hover:border-aldi-blue/40"
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleHotspotClick(h);
                    }}
                    aria-label={h.product.name}
                  />

                  {onList && !isActive && (
                    <span className="pointer-events-none absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-white">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                    </span>
                  )}

                  {isActive && (
                    <div className="pointer-events-auto absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-lg bg-white px-3 py-2 shadow-lg ring-1 ring-black/5">
                      <p className="text-sm font-medium text-aldi-text">{h.product.name}</p>
                      {displayPrice != null && (
                        <p className="text-sm tabular-nums text-aldi-blue font-semibold">{"\u20AC"}{displayPrice.toFixed(2)}</p>
                      )}
                      {onList ? (
                        <span className="mt-1 flex items-center gap-1 text-xs text-green-600">
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                          {t("alreadyOnList")}
                        </span>
                      ) : (
                        <button
                          type="button"
                          className="mt-1 flex items-center gap-1 rounded-md bg-aldi-blue px-2 py-1 text-xs font-medium text-white"
                          onClick={(e) => {
                            e.stopPropagation();
                            onHotspotTap?.(h.product);
                            setActiveHotspot(null);
                          }}
                        >
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                          {t("addToList")}
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
