"use client";

import { useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { updateBestBefore } from "@/lib/inventory/inventory-freeze";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

interface InventoryEditSheetProps {
  item: InventoryItem | null;
  onClose: () => void;
  onSaved: () => void;
}

export function InventoryEditSheet({ item, onClose, onSaved }: InventoryEditSheetProps) {
  const t = useTranslations("inventory");
  const [bestBefore, setBestBefore] = useState(item?.best_before ?? "");
  const [saving, setSaving] = useState(false);

  const handleSave = useCallback(async () => {
    if (!item) return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    setSaving(true);
    const ok = await updateBestBefore(supabase, item.id, bestBefore || null);
    setSaving(false);

    if (ok) {
      onSaved();
      onClose();
    }
  }, [item, bestBefore, onSaved, onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-aldi-muted-light px-4 py-3">
          <p className="text-sm font-semibold text-aldi-text">{item.display_name}</p>
        </div>
        <div className="flex flex-col gap-4 px-4 py-4">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="mhd-input" className="text-xs font-medium text-aldi-muted">
              {t("bestBeforeLabel")}
            </label>
            <input
              id="mhd-input"
              type="date"
              className="w-full rounded-xl border border-aldi-muted-light bg-gray-50 px-3 py-2.5 text-sm text-aldi-text outline-none focus:border-aldi-blue focus:ring-1 focus:ring-aldi-blue"
              value={bestBefore}
              onChange={(e) => setBestBefore(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-aldi-muted-light px-4 py-2.5 text-sm font-medium text-aldi-text transition-colors hover:bg-gray-50"
            >
              {t("editCancel")}
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex-1 rounded-xl bg-aldi-blue px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {saving ? t("editSaving") : t("editSave")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
