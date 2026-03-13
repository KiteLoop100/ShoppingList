"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { updateListItem } from "@/lib/list";
import { log } from "@/lib/utils/logger";

const MAX_COMMENT_LENGTH = 500;
const DEBOUNCE_MS = 500;

export function useItemComment(
  itemId: string | null,
  initialComment: string | null,
  onCommentChange?: (itemId: string, comment: string | null) => void,
) {
  const [comment, setCommentRaw] = useState(initialComment ?? "");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialComment ?? "");
  const itemIdRef = useRef(itemId);
  const commentRef = useRef(comment);
  const onCommentChangeRef = useRef(onCommentChange);
  onCommentChangeRef.current = onCommentChange;

  useEffect(() => {
    itemIdRef.current = itemId;
    setCommentRaw(initialComment ?? "");
    lastSavedRef.current = initialComment ?? "";
    commentRef.current = initialComment ?? "";
  }, [itemId, initialComment]);

  const persistComment = useCallback(async (value: string) => {
    const id = itemIdRef.current;
    if (!id) return;
    if (value === lastSavedRef.current) return;

    setSaving(true);
    try {
      const savedValue = value || null;
      await updateListItem(id, { comment: savedValue });
      lastSavedRef.current = value;
      onCommentChangeRef.current?.(id, savedValue);
    } catch (e) {
      log.warn("[useItemComment] save failed:", e);
    } finally {
      setSaving(false);
    }
  }, []);

  const setComment = useCallback(
    (value: string) => {
      const clamped = value.slice(0, MAX_COMMENT_LENGTH);
      setCommentRaw(clamped);
      commentRef.current = clamped;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        persistComment(clamped);
      }, DEBOUNCE_MS);
    },
    [persistComment]
  );

  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    persistComment(commentRef.current);
  }, [persistComment]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const current = commentRef.current;
      const id = itemIdRef.current;
      if (id && current !== lastSavedRef.current) {
        const savedValue = current || null;
        onCommentChangeRef.current?.(id, savedValue);
        updateListItem(id, { comment: savedValue }).catch((e) => {
          log.warn("[useItemComment] flush-on-unmount failed:", e);
        });
      }
    };
  }, []);

  return { comment, setComment, flush, saving };
}
