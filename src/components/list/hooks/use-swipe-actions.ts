import { useState, useRef, useCallback } from "react";

export const SWIPE_THRESHOLD = 60;
export const DELETE_WIDTH = 80;
export const DEFER_WIDTH = 80;
export const ELSEWHERE_THRESHOLD = 100;
export const ELSEWHERE_WIDTH = 120;

const HORIZONTAL_SLOP = 18;
const HORIZONTAL_RATIO = 1.4;

export interface UseSwipeActionsOptions {
  hasRightSwipe: boolean;
  canBuyElsewhere: boolean;
}

export interface SwipeActions {
  translateX: number;
  setTranslateX: (x: number) => void;
  isSnappedElsewhere: boolean;
  handleTouchStart: (e: React.TouchEvent) => void;
  handleTouchMove: (e: React.TouchEvent) => void;
  handleTouchEnd: () => void;
}

export function useSwipeActions({
  hasRightSwipe,
  canBuyElsewhere,
}: UseSwipeActionsOptions): SwipeActions {
  const [translateX, setTranslateX] = useState(0);
  const touchStartX = useRef(0);
  const touchStartY = useRef(0);
  const translateXAtStart = useRef(0);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      touchStartX.current = e.targetTouches[0].clientX;
      touchStartY.current = e.targetTouches[0].clientY;
      translateXAtStart.current = translateX;
    },
    [translateX],
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      const curX = e.targetTouches[0].clientX;
      const curY = e.targetTouches[0].clientY;
      const deltaX = touchStartX.current - curX;
      const deltaY = touchStartY.current - curY;
      const absX = Math.abs(deltaX);
      const absY = Math.abs(deltaY);
      if (absX >= HORIZONTAL_SLOP && absX >= absY * HORIZONTAL_RATIO) {
        const newX = translateXAtStart.current + deltaX;
        const minX = hasRightSwipe
          ? canBuyElsewhere
            ? -ELSEWHERE_WIDTH
            : -DEFER_WIDTH
          : 0;
        setTranslateX(Math.max(minX, Math.min(DELETE_WIDTH, newX)));
      }
    },
    [hasRightSwipe, canBuyElsewhere],
  );

  const handleTouchEnd = useCallback(() => {
    if (translateX >= SWIPE_THRESHOLD) {
      setTranslateX(DELETE_WIDTH);
    } else if (translateX <= -ELSEWHERE_THRESHOLD && canBuyElsewhere) {
      setTranslateX(-ELSEWHERE_WIDTH);
    } else if (translateX <= -SWIPE_THRESHOLD && hasRightSwipe) {
      setTranslateX(-DEFER_WIDTH);
    } else {
      setTranslateX(0);
    }
  }, [translateX, hasRightSwipe, canBuyElsewhere]);

  const isSnappedElsewhere = translateX <= -ELSEWHERE_THRESHOLD;

  return {
    translateX,
    setTranslateX,
    isSnappedElsewhere,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
  };
}
