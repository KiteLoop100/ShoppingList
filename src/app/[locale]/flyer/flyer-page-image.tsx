"use client";

import { useEffect, useRef, useState } from "react";

interface FlyerPageImageProps {
  imageUrl: string;
  className?: string;
  alt?: string;
}

/** Renders a flyer page: PDF URLs are drawn to canvas via pdfjs-dist; image URLs use <img>. */
export function FlyerPageImage({ imageUrl, className, alt = "" }: FlyerPageImageProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const isPdf = imageUrl.toLowerCase().endsWith(".pdf");

  useEffect(() => {
    if (!isPdf) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const pdfjsLib = await import("pdfjs-dist");
        if (typeof pdfjsLib.GlobalWorkerOptions?.workerSrc === "undefined" || !pdfjsLib.GlobalWorkerOptions.workerSrc) {
          const version = (pdfjsLib as { version?: string }).version || "4.10.38";
          pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
        }
        const doc = await pdfjsLib.getDocument({ url: imageUrl }).promise;
        if (cancelled) return;
        const page = await doc.getPage(1);
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const scale = 2;
        const viewport = page.getViewport({ scale });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        const renderTask = page.render({
          canvasContext: ctx,
          viewport,
        });
        const renderPromise =
          renderTask && typeof (renderTask as { promise?: Promise<void> }).promise !== "undefined"
            ? (renderTask as { promise: Promise<void> }).promise
            : Promise.resolve();
        await renderPromise;
        if (!cancelled) setLoading(false);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "PDF konnte nicht geladen werden.");
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [imageUrl, isPdf]);

  if (!isPdf) {
    return (
      <img
        src={imageUrl}
        alt={alt}
        className={className}
      />
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center bg-aldi-muted-light/30 ${className ?? ""}`}>
        <p className="text-sm text-aldi-muted">{error}</p>
        <a
          href={imageUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-aldi-blue underline"
        >
          PDF öffnen
        </a>
      </div>
    );
  }

  return (
    <div className="relative">
      {loading && (
        <div className={`flex min-h-[200px] items-center justify-center bg-aldi-muted-light/30 ${className ?? ""}`}>
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent" />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={className}
        style={{
          display: loading ? "none" : "block",
          width: "100%",
          height: "auto",
          maxWidth: "100%",
        }}
      />
    </div>
  );
}
