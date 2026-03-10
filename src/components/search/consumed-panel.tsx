"use client";

import { useEffect, useState, useCallback } from "react";
import { useTranslations } from "next-intl";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import {
  loadInventory,
  consumeInventoryItem,
} from "@/lib/inventory/inventory-service";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

interface ConsumedPanelProps {
  onCancel: () => void;
}

export function ConsumedPanel({ onCancel }: ConsumedPanelProps) {
  const t = useTranslations("inventory");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [consumed, setConsumed] = useState<Set<string>>(new Set());

  useEffect(() => {
    const supabase = createClientIfConfigured();
    if (!supabase) { setLoading(false); return; }

    const userId = getCurrentUserId();
    loadInventory(supabase, userId).then((data) => {
      setItems(data);
      setLoading(false);
    });
  }, []);

  const handleConsume = useCallback(async (itemId: string) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    const ok = await consumeInventoryItem(supabase, itemId);
    if (ok) {
      setConsumed((prev) => new Set(prev).add(itemId));
    }
  }, []);

  const activeItems = items.filter((i) => !consumed.has(i.id));

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white">
      <div className="flex items-center justify-between border-b border-aldi-muted-light bg-gray-50 px-4 py-2.5">
        <span className="text-sm font-semibold text-aldi-text">{t("consumedTitle")}</span>
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-aldi-muted transition-colors hover:text-aldi-text"
        >
          ✕
        </button>
      </div>

      <div className="max-h-[50vh] overflow-auto">
        {loading ? (
          <div className="flex items-center gap-2 px-4 py-6">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent" />
            <span className="text-sm text-aldi-muted">{t("consumedTitle")}</span>
          </div>
        ) : activeItems.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-aldi-muted">
            {t("consumedEmpty")}
          </p>
        ) : (
          activeItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center gap-3 border-b border-aldi-muted-light px-4 py-2.5 last:border-b-0"
            >
              {item.thumbnail_url ? (
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-lg object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-aldi-muted-light text-xs text-aldi-muted">
                  ▪
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-aldi-text">
                  {item.display_name}
                </p>
                <p className="text-[11px] text-aldi-muted">
                  {item.quantity}x • {item.status === "opened" ? t("statusOpened") : t("statusSealed")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleConsume(item.id)}
                className="shrink-0 rounded-lg bg-red-50 px-3 py-1.5 text-xs font-medium text-red-600 transition-colors hover:bg-red-100"
              >
                {t("swipeConsumed")}
              </button>
            </div>
          ))
        )}
      </div>

      {consumed.size > 0 && (
        <div className="border-t border-aldi-muted-light bg-green-50 px-4 py-2 text-center text-xs font-medium text-green-700">
          {consumed.size} {t("statusConsumed").toLowerCase()}
        </div>
      )}
    </div>
  );
}
