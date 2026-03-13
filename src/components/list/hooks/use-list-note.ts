"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { updateShoppingListNotes } from "@/lib/list";
import { log } from "@/lib/utils/logger";

const MAX_NOTE_LENGTH = 500;
const DEBOUNCE_MS = 500;

export function useListNote(
  listId: string | null,
  initialNotes: string | null,
) {
  const [note, setNoteRaw] = useState(initialNotes ?? "");
  const [saving, setSaving] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef(initialNotes ?? "");
  const listIdRef = useRef(listId);
  const noteRef = useRef(note);

  useEffect(() => {
    listIdRef.current = listId;
    setNoteRaw(initialNotes ?? "");
    lastSavedRef.current = initialNotes ?? "";
    noteRef.current = initialNotes ?? "";
  }, [listId, initialNotes]);

  const persistNote = useCallback(async (value: string) => {
    const id = listIdRef.current;
    if (!id) return;
    if (value === lastSavedRef.current) return;

    setSaving(true);
    try {
      await updateShoppingListNotes(id, value || null);
      lastSavedRef.current = value;
    } catch (e) {
      log.warn("[useListNote] save failed:", e);
    } finally {
      setSaving(false);
    }
  }, []);

  const setNote = useCallback(
    (value: string) => {
      const clamped = value.slice(0, MAX_NOTE_LENGTH);
      setNoteRaw(clamped);
      noteRef.current = clamped;

      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        persistNote(clamped);
      }, DEBOUNCE_MS);
    },
    [persistNote],
  );

  const flush = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    persistNote(noteRef.current);
  }, [persistNote]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      const current = noteRef.current;
      const id = listIdRef.current;
      if (id && current !== lastSavedRef.current) {
        updateShoppingListNotes(id, current || null).catch((e) => {
          log.warn("[useListNote] flush-on-unmount failed:", e);
        });
      }
    };
  }, []);

  return { note, setNote, flush, saving };
}
