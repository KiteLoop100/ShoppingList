"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useListNote } from "./hooks/use-list-note";

const CHAR_WARNING_THRESHOLD = 400;
const MAX_NOTE_LENGTH = 500;

interface TripNoteSectionProps {
  listId: string;
  initialNotes: string | null;
}

export function TripNoteSection({ listId, initialNotes }: TripNoteSectionProps) {
  const t = useTranslations("list");
  const { note, setNote, flush, saving } = useListNote(listId, initialNotes);
  const [expanded, setExpanded] = useState(!!initialNotes);

  return (
    <div className="rounded-xl border border-aldi-muted-light bg-white px-3 py-2">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center gap-2 text-left"
      >
        <svg
          className="h-4 w-4 shrink-0 text-aldi-blue"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
          />
        </svg>
        <span className="flex-1 text-sm font-medium text-aldi-text">
          {t("tripNote")}
        </span>
        {saving && (
          <span className="text-xs text-aldi-muted">{t("tripNoteSaving")}</span>
        )}
        <svg
          className={`h-4 w-4 shrink-0 text-aldi-muted transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2}
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </button>

      {expanded && (
        <div className="mt-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onBlur={flush}
            placeholder={t("tripNotePlaceholder")}
            maxLength={MAX_NOTE_LENGTH}
            rows={3}
            className="w-full resize-y rounded-lg border border-aldi-muted-light bg-gray-50 px-3 py-2 text-sm text-aldi-text placeholder:text-aldi-muted/60 focus:border-aldi-blue focus:outline-none focus:ring-1 focus:ring-aldi-blue"
            style={{ maxHeight: "8rem" }}
          />
          {note.length >= CHAR_WARNING_THRESHOLD && (
            <p className="mt-1 text-right text-xs text-aldi-muted">
              {note.length}/{MAX_NOTE_LENGTH}
            </p>
          )}
        </div>
      )}

      {!expanded && note && (
        <p className="mt-1 truncate text-xs text-aldi-muted">{note}</p>
      )}
    </div>
  );
}
