"use client";

import { useTranslations } from "next-intl";
import { useItemComment } from "./hooks/use-item-comment";

const CHAR_WARNING_THRESHOLD = 400;
const MAX_COMMENT_LENGTH = 500;

interface ItemCommentSectionProps {
  itemId: string | null;
  initialComment: string | null;
}

export function ItemCommentSection({ itemId, initialComment }: ItemCommentSectionProps) {
  const t = useTranslations("productDetail");
  const { comment, setComment, flush, saving } = useItemComment(itemId, initialComment);

  if (!itemId) return null;

  return (
    <div className="mt-4 border-t border-aldi-muted-light pt-4">
      <div className="flex items-center gap-2">
        <svg
          className="h-4 w-4 text-aldi-blue"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.076-4.076a1.526 1.526 0 0 1 1.037-.443 48.282 48.282 0 0 0 5.68-.494c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
          />
        </svg>
        <span className="text-sm font-medium text-aldi-text">{t("comment")}</span>
        {saving && (
          <span className="text-xs text-aldi-muted">{t("commentSaving")}</span>
        )}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        onBlur={flush}
        placeholder={t("commentPlaceholder")}
        maxLength={MAX_COMMENT_LENGTH}
        rows={3}
        className="mt-2 w-full resize-y rounded-lg border border-aldi-muted-light bg-gray-50 px-3 py-2 text-sm text-aldi-text placeholder:text-aldi-muted/60 focus:border-aldi-blue focus:outline-none focus:ring-1 focus:ring-aldi-blue"
        style={{ maxHeight: "8rem" }}
      />
      {comment.length >= CHAR_WARNING_THRESHOLD && (
        <p className="mt-1 text-right text-xs text-aldi-muted">
          {t("commentCharCount", { count: comment.length })}
        </p>
      )}
    </div>
  );
}
