"use client";

import { useTranslations } from "next-intl";
import { ELSEWHERE_WIDTH } from "./hooks/use-swipe-actions";
import { Tooltip } from "@/components/common/tooltip";

const Z1_STYLE = { zIndex: 1 } as const;
const Z2_HIDDEN_STYLE = {
  zIndex: 2,
  pointerEvents: "none" as const,
  opacity: 0,
} as const;

/* ------------------------------------------------------------------ */
/* Swipe-revealed action buttons (behind the row)                     */
/* ------------------------------------------------------------------ */

export interface SwipeActionsProps {
  hasRightSwipe: boolean;
  canUndefer: boolean;
  canBuyElsewhere: boolean;
  isSnappedElsewhere: boolean;
  deleteLabel: string;
  onDeferTap: () => void;
  onElsewhereTap: () => void;
  onDelete: () => void;
}

export function SwipeActionButtons({
  hasRightSwipe,
  canUndefer,
  canBuyElsewhere,
  isSnappedElsewhere,
  deleteLabel,
  onDeferTap,
  onElsewhereTap,
  onDelete,
}: SwipeActionsProps) {
  const t = useTranslations("list");

  return (
    <>
      {hasRightSwipe && (
        <>
          <button
            type="button"
            className="absolute left-0 top-0 flex h-full w-20 items-center justify-center bg-aldi-blue text-[11px] font-medium leading-tight text-white transition-opacity duration-ui"
            style={Z1_STYLE}
            onClick={onDeferTap}
            aria-label={canUndefer ? t("uncheckItem") : t("deferToNextTrip")}
          >
            {canUndefer ? "↩" : t("deferToNextTrip")}
          </button>

          {canBuyElsewhere && (
            <button
              type="button"
              className="absolute left-0 top-0 flex h-full items-center justify-center bg-orange-500 text-[11px] font-semibold leading-tight text-white transition-opacity duration-200"
              style={
                isSnappedElsewhere
                  ? {
                      zIndex: 2,
                      width: ELSEWHERE_WIDTH,
                      opacity: 1,
                      pointerEvents: "auto" as const,
                    }
                  : { ...Z2_HIDDEN_STYLE, width: ELSEWHERE_WIDTH }
              }
              onClick={onElsewhereTap}
              aria-label={t("elsewhereSwipeLabel")}
            >
              {t("elsewhereSwipeLabel")}
            </button>
          )}
        </>
      )}

      <button
        type="button"
        className="absolute right-0 top-0 flex h-full w-20 items-center justify-center bg-aldi-error text-sm font-medium text-white transition-opacity duration-ui"
        style={Z1_STYLE}
        onClick={onDelete}
        aria-label={deleteLabel}
      >
        {deleteLabel}
      </button>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Desktop hover action buttons (shown on pointer:fine)               */
/* ------------------------------------------------------------------ */

export interface HoverActionsProps {
  canDefer: boolean;
  canUndefer: boolean;
  canBuyElsewhere: boolean;
  deleteLabel: string;
  onDeferTap: () => void;
  onElsewhereTap: () => void;
  onDelete: () => void;
}

export function HoverActionButtons({
  canDefer,
  canUndefer,
  canBuyElsewhere,
  deleteLabel,
  onDeferTap,
  onElsewhereTap,
  onDelete,
}: HoverActionsProps) {
  const t = useTranslations("list");

  const deferLabel = canUndefer ? t("uncheckItem") : t("deferToNextTrip");

  return (
    <div className="pointer-coarse:hidden flex shrink-0 items-center gap-0.5">
      {(canDefer || canUndefer) && (
        <Tooltip content={deferLabel}>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-aldi-blue transition-colors hover:bg-aldi-blue/10"
            onClick={(e) => {
              e.stopPropagation();
              onDeferTap();
            }}
            aria-label={deferLabel}
          >
            {canUndefer ? (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
              </svg>
            )}
          </button>
        </Tooltip>
      )}
      {canBuyElsewhere && (
        <Tooltip content={t("elsewhereSwipeLabel")}>
          <button
            type="button"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-orange-500 transition-colors hover:bg-orange-50"
            onClick={(e) => {
              e.stopPropagation();
              onElsewhereTap();
            }}
            aria-label={t("elsewhereSwipeLabel")}
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
            </svg>
          </button>
        </Tooltip>
      )}
      <Tooltip content={deleteLabel}>
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-lg text-aldi-error transition-colors hover:bg-red-50"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          aria-label={deleteLabel}
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
          </svg>
        </button>
      </Tooltip>
    </div>
  );
}
