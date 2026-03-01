"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ONBOARDING_SCREENS } from "./onboarding-registry";

const SWIPE_THRESHOLD = 50;
const ONBOARDING_COMPLETE_KEY = "onboarding-complete";

interface OnboardingFlowProps {
  onComplete: () => void;
  showSkip?: boolean;
}

export function OnboardingFlow({ onComplete, showSkip = true }: OnboardingFlowProps) {
  const t = useTranslations("onboarding");
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offsetX, setOffsetX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isDraggingRef = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const total = ONBOARDING_SCREENS.length;
  const isFirst = currentIndex === 0;
  const isLast = currentIndex === total - 1;

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  const goTo = useCallback((index: number) => {
    if (index < 0 || index >= total) return;
    setIsAnimating(true);
    setCurrentIndex(index);
    setOffsetX(0);
    setTimeout(() => setIsAnimating(false), 300);
  }, [total]);

  const goNext = useCallback(() => {
    if (isLast) return;
    goTo(currentIndex + 1);
  }, [currentIndex, isLast, goTo]);

  const goPrev = useCallback(() => {
    if (isFirst) return;
    goTo(currentIndex - 1);
  }, [currentIndex, isFirst, goTo]);

  const handleComplete = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    onComplete();
  }, [onComplete]);

  const handleSkip = useCallback(() => {
    localStorage.setItem(ONBOARDING_COMPLETE_KEY, "true");
    onComplete();
  }, [onComplete]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (isAnimating) return;
    const touch = e.touches[0];
    touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
    isDraggingRef.current = false;
  }, [isAnimating]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartRef.current || isAnimating) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartRef.current.x;
    const dy = touch.clientY - touchStartRef.current.y;

    if (!isDraggingRef.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.2) {
        isDraggingRef.current = true;
      } else {
        return;
      }
    }

    let clampedDx = dx;
    if ((isFirst && dx > 0) || (isLast && dx < 0)) {
      clampedDx = dx * 0.3;
    }
    setOffsetX(clampedDx);
  }, [isAnimating, isFirst, isLast]);

  const handleTouchEnd = useCallback(() => {
    if (!touchStartRef.current || !isDraggingRef.current) {
      touchStartRef.current = null;
      return;
    }

    const elapsed = Date.now() - touchStartRef.current.time;
    const velocity = Math.abs(offsetX) / elapsed;
    const shouldSwipe = Math.abs(offsetX) > SWIPE_THRESHOLD || velocity > 0.5;

    if (shouldSwipe) {
      if (offsetX < 0 && !isLast) {
        goNext();
      } else if (offsetX > 0 && !isFirst) {
        goPrev();
      } else {
        setOffsetX(0);
      }
    } else {
      setOffsetX(0);
    }

    touchStartRef.current = null;
    isDraggingRef.current = false;
  }, [offsetX, isFirst, isLast, goNext, goPrev]);

  const CurrentScreen = ONBOARDING_SCREENS[currentIndex].component;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label="Onboarding"
    >
      {/* Skip button */}
      {showSkip && (
        <div className="absolute right-4 top-4 z-10">
          <button
            type="button"
            onClick={handleSkip}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-aldi-muted transition-colors hover:bg-aldi-muted-light/50 hover:text-aldi-text"
          >
            {t("skip")}
          </button>
        </div>
      )}

      {/* Screen content area with touch handling */}
      <div
        ref={containerRef}
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <div
          className="flex h-full flex-col"
          style={{
            transform: `translateX(${offsetX}px)`,
            transition: isDraggingRef.current ? "none" : "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <CurrentScreen />
        </div>
      </div>

      {/* Bottom navigation area */}
      <div className="shrink-0 bg-white pb-8 pt-2">
        {/* Dot indicators */}
        <div className="mb-5 flex items-center justify-center gap-2">
          {ONBOARDING_SCREENS.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              className={`rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "h-2.5 w-2.5 bg-aldi-blue"
                  : "h-2 w-2 bg-aldi-muted-light hover:bg-aldi-muted"
              }`}
              aria-label={`Screen ${i + 1} of ${total}`}
              aria-current={i === currentIndex ? "step" : undefined}
            />
          ))}
        </div>

        {/* Navigation buttons */}
        <div className="flex items-center justify-center gap-3 px-6">
          {!isFirst && (
            <button
              type="button"
              onClick={goPrev}
              className="min-h-touch flex-1 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] font-semibold text-aldi-text transition-colors hover:border-aldi-blue/30"
            >
              {t("back")}
            </button>
          )}
          {isLast ? (
            <button
              type="button"
              onClick={handleComplete}
              className="min-h-touch flex-1 rounded-xl bg-aldi-blue px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-aldi-blue/90 active:scale-[0.98]"
            >
              {t("done")}
            </button>
          ) : (
            <button
              type="button"
              onClick={goNext}
              className="min-h-touch flex-1 rounded-xl bg-aldi-blue px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-aldi-blue/90 active:scale-[0.98]"
            >
              {t("next")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export { ONBOARDING_COMPLETE_KEY };
