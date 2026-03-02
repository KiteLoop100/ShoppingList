"use client";

import { memo } from "react";
import type { SearchResult } from "@/types";

export interface SearchResultsPanelProps {
  loading: boolean;
  results: SearchResult[];
  query: string;
  onSelect: (r: SearchResult) => void;
  onAddGeneric: () => void;
  noResultsLabel: string;
  searchingLabel: string;
}

export const SearchResultsPanel = memo(function SearchResultsPanel({
  loading,
  results,
  query,
  onSelect,
  onAddGeneric,
  searchingLabel,
}: SearchResultsPanelProps) {
  return (
    <div
      className="absolute inset-0 z-10 flex flex-col overflow-auto bg-white"
      role="listbox"
    >
      {loading ? (
        <div className="p-4 text-center text-sm text-aldi-muted">
          {searchingLabel}
        </div>
      ) : (
        <>
          <button
            type="button"
            className="flex min-h-touch w-full items-center gap-3 border-b border-aldi-muted-light px-4 py-3 text-left text-[15px] text-aldi-blue transition-colors hover:bg-aldi-blue/5"
            onClick={onAddGeneric}
          >
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-aldi-blue text-white text-sm font-bold">+</span>
            <span className="flex-1 truncate font-medium">&ldquo;{query}&rdquo;</span>
          </button>
          {results.length > 0 && (
            <ul className="py-1">
              {results.map((r) => (
                <li key={r.product_id} role="option" aria-selected="false">
                  <button
                    type="button"
                    className="flex min-h-touch w-full items-center justify-between gap-3 px-4 py-3 text-left text-[15px] text-aldi-text transition-colors hover:bg-aldi-muted-light/40 focus:bg-aldi-muted-light/40 focus:outline-none"
                    onClick={() => onSelect(r)}
                  >
                    <span className="flex-1 truncate">
                      {r.source === "favorite" && <span className="text-aldi-orange">★ </span>}
                      {r.name}
                    </span>
                    {r.price != null && (
                      <span className="shrink-0 text-sm font-medium tabular-nums text-aldi-muted">
                        €{r.price.toFixed(2)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
});
