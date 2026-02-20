"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  getStoresSorted,
  setListStore,
  getCurrentPosition,
  type GeoPosition,
} from "@/lib/store/store-service";
import { useCurrentCountry } from "@/lib/current-country-context";
import type { LocalStore } from "@/lib/db";

function normalizeForFilter(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function storeMatchesQuery(store: LocalStore, queryNorm: string): boolean {
  if (!queryNorm) return true;
  const name = normalizeForFilter(store.name);
  const address = normalizeForFilter(store.address);
  const city = normalizeForFilter(store.city);
  const postal = normalizeForFilter(store.postal_code);
  return (
    name.includes(queryNorm) ||
    address.includes(queryNorm) ||
    city.includes(queryNorm) ||
    postal.includes(queryNorm)
  );
}

export interface StorePickerOverlayProps {
  open: boolean;
  listId: string | null;
  onClose: () => void;
  /** Called after store is set; can be async. Overlay closes after this completes so header and list sort update. */
  onStoreSelected: () => void | Promise<void>;
}

export function StorePickerOverlay({
  open,
  listId,
  onClose,
  onStoreSelected,
}: StorePickerOverlayProps) {
  const t = useTranslations("store");
  const tCommon = useTranslations("common");
  const { setCountry } = useCurrentCountry();
  const [stores, setStores] = useState<LocalStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [coords, setCoords] = useState<GeoPosition | null>(null);

  const loadStores = useCallback(async () => {
    setLoading(true);
    try {
      let pos: GeoPosition | null = null;
      try {
        pos = await getCurrentPosition();
        setCoords(pos);
      } catch {
        setCoords(null);
      }
      const list = await getStoresSorted(pos ?? undefined);
      setStores(list);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      setSearchQuery("");
      loadStores();
    }
  }, [open, loadStores]);

  const searchNorm = normalizeForFilter(searchQuery);
  const filteredStores = useMemo(
    () => (searchNorm ? stores.filter((s) => storeMatchesQuery(s, searchNorm)) : stores),
    [stores, searchNorm]
  );

  const handleSelect = useCallback(
    async (store: LocalStore) => {
      if (!listId) return;
      await setListStore(listId, store.store_id);
      setCountry(store.country.toUpperCase());
      await Promise.resolve(onStoreSelected());
      onClose();
    },
    [listId, setCountry, onStoreSelected, onClose]
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-20 flex flex-col bg-white"
      role="dialog"
      aria-modal="true"
      aria-label={t("selectStore")}
    >
      <header className="flex shrink-0 items-center gap-2 border-b border-aldi-muted-light bg-white px-4 py-3">
        <button
          type="button"
          className="touch-target rounded-lg font-medium text-aldi-blue transition-colors hover:bg-aldi-muted-light/50"
          onClick={onClose}
          aria-label={tCommon("back")}
        >
          ← {tCommon("back")}
        </button>
        <h2 className="flex-1 text-center text-lg font-bold text-aldi-blue">
          {t("selectStore")}
        </h2>
        <span className="w-16" aria-hidden />
      </header>
      <div className="flex shrink-0 px-4 pb-3">
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("searchPlaceholder")}
          className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:border-aldi-blue focus:outline-none"
          aria-label={t("searchPlaceholder")}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-auto px-4 pb-4">
        {loading ? (
          <p className="py-8 text-center text-aldi-muted">{tCommon("loading")}</p>
        ) : filteredStores.length === 0 ? (
          <p className="py-8 text-center text-aldi-muted">
            {stores.length === 0 ? t("noStore") : t("noStoresMatch")}
          </p>
        ) : (
          <ul className="space-y-3">
            {filteredStores.map((store) => (
              <li key={store.store_id}>
                <button
                  type="button"
                  className="flex min-h-touch w-full items-center justify-between rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-left transition-colors hover:border-aldi-blue/30 hover:bg-aldi-muted-light/30"
                  onClick={() => handleSelect(store)}
                >
                  <span className="font-semibold text-aldi-text">{store.name}</span>
                  <span className="text-sm text-aldi-muted">
                    {store.city}, {store.postal_code}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
