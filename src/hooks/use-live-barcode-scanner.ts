"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createScannerEngine,
  type ScannerEngine,
} from "@/lib/barcode/scanner-engine";

const SCAN_INTERVAL_MS = 100; // ~10 fps max

export type ScannerStatus = "idle" | "initializing" | "scanning" | "error";

/**
 * React hook that manages a live camera stream and continuously scans
 * video frames for EAN/UPC barcodes.
 *
 * The scan loop uses the optimal backend automatically:
 * - Native BarcodeDetector (passes video element directly, zero-copy)
 * - ZBar WASM fallback (extracts ImageData via canvas)
 */
export function useLiveBarcodeScanner(onDetected: (ean: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState<ScannerStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Stable ref so the scan loop always calls the latest callback
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  const engineRef = useRef<ScannerEngine | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const mountedRef = useRef(true);
  const scanGateRef = useRef(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);

  const teardown = useCallback(() => {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (engineRef.current) {
      engineRef.current.dispose();
      engineRef.current = null;
    }
    canvasRef.current = null;
    ctxRef.current = null;
    scanGateRef.current = false;
  }, []);

  const start = useCallback(async () => {
    teardown();
    if (!mountedRef.current) return;
    setStatus("initializing");
    setErrorMessage(null);

    try {
      const engine = await createScannerEngine();
      if (!mountedRef.current) {
        engine.dispose();
        return;
      }
      engineRef.current = engine;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
        });
      }
      if (!mountedRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        engine.dispose();
        return;
      }
      streamRef.current = stream;

      const video = videoRef.current;
      if (!video) throw new Error("Video element not mounted");
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      // Canvas is only needed when the engine lacks the native fast path
      if (!engine.scanVideo) {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) throw new Error("Canvas 2D context unavailable");
        canvasRef.current = canvas;
        ctxRef.current = ctx;
      }

      if (!mountedRef.current) {
        teardown();
        return;
      }
      setStatus("scanning");

      // ---- scan loop ----
      let lastScanTime = 0;

      const loop = (timestamp: number) => {
        if (!mountedRef.current) return;
        rafRef.current = requestAnimationFrame(loop);

        if (timestamp - lastScanTime < SCAN_INTERVAL_MS) return;
        if (scanGateRef.current) return;

        const v = videoRef.current;
        const eng = engineRef.current;
        if (!v || v.readyState < 2 || !eng) return;

        const w = v.videoWidth;
        const h = v.videoHeight;
        if (w === 0 || h === 0) return;

        lastScanTime = timestamp;
        scanGateRef.current = true;

        let promise: Promise<string | null>;

        if (eng.scanVideo) {
          promise = eng.scanVideo(v);
        } else {
          const canvas = canvasRef.current!;
          const ctx = ctxRef.current!;
          canvas.width = w;
          canvas.height = h;
          ctx.drawImage(v, 0, 0);
          const imageData = ctx.getImageData(0, 0, w, h);
          promise = eng.scanFrame(imageData);
        }

        promise
          .then((ean) => {
            scanGateRef.current = false;
            if (ean && mountedRef.current) {
              onDetectedRef.current(ean);
            }
          })
          .catch(() => {
            scanGateRef.current = false;
          });
      };

      rafRef.current = requestAnimationFrame(loop);
    } catch (err) {
      if (!mountedRef.current) return;
      setStatus("error");
      const msg = err instanceof Error ? err.message : "Camera unavailable";
      setErrorMessage(
        msg.includes("Permission") ||
          msg.includes("NotAllowed") ||
          msg.includes("permission")
          ? "PERMISSION_DENIED"
          : msg,
      );
    }
  }, [teardown]);

  const stop = useCallback(() => {
    teardown();
    setStatus("idle");
  }, [teardown]);

  const restart = useCallback(() => {
    void start();
  }, [start]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      teardown();
    };
  }, [teardown]);

  return { videoRef, status, errorMessage, start, stop, restart } as const;
}
