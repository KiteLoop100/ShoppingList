"use client";

import { useTranslations } from "next-intl";
import type { InventoryItem } from "@/lib/inventory/inventory-types";

interface InventoryActionsSheetProps {
  item: InventoryItem;
  onClose: () => void;
  onOpen: (id: string) => void;
  onSeal: (id: string) => void;
  onFreeze: (id: string) => void;
  onThaw: (id: string) => void;
  onConsume: (id: string) => void;
  onConsumeAndAddToList: (id: string) => void;
  onDelete: (id: string) => void;
  onEditBestBefore?: (item: InventoryItem) => void;
  onShowQuantityPicker: () => void;
}

export function InventoryActionsSheet({
  item,
  onClose,
  onOpen,
  onSeal,
  onFreeze,
  onThaw,
  onConsume,
  onConsumeAndAddToList,
  onDelete,
  onEditBestBefore,
  onShowQuantityPicker,
}: InventoryActionsSheetProps) {
  const t = useTranslations("inventory");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-sm rounded-2xl bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-aldi-muted-light px-4 py-3">
          <p className="text-sm font-medium text-aldi-text">{item.display_name}</p>
        </div>
        {item.status === "sealed" && (
          <button
            type="button"
            onClick={() => { onOpen(item.id); onClose(); }}
            className="w-full px-4 py-3 text-left text-sm text-aldi-text transition-colors hover:bg-gray-50"
          >
            {t("swipeOpened")}
          </button>
        )}
        {item.status === "opened" && (
          <button
            type="button"
            onClick={() => { onSeal(item.id); onClose(); }}
            className="w-full px-4 py-3 text-left text-sm text-aldi-text transition-colors hover:bg-gray-50"
          >
            {t("swipeSealed")}
          </button>
        )}
        {!item.is_frozen ? (
          <button
            type="button"
            onClick={() => { onFreeze(item.id); onClose(); }}
            className="w-full px-4 py-3 text-left text-sm text-aldi-text transition-colors hover:bg-gray-50"
          >
            {t("freezeAction")}
          </button>
        ) : (
          <button
            type="button"
            onClick={() => { onThaw(item.id); onClose(); }}
            className="w-full px-4 py-3 text-left text-sm text-aldi-text transition-colors hover:bg-gray-50"
          >
            {t("thawAction")}
          </button>
        )}
        {onEditBestBefore && (
          <button
            type="button"
            onClick={() => { onClose(); onEditBestBefore(item); }}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm text-aldi-text transition-colors hover:bg-gray-50"
          >
            <span>{t("editBestBefore")}</span>
            {item.best_before && (
              <span className="text-xs text-aldi-muted">{new Date(item.best_before).toLocaleDateString("de-DE")}</span>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => { onClose(); onShowQuantityPicker(); }}
          className="w-full px-4 py-3 text-left text-sm text-aldi-text transition-colors hover:bg-gray-50"
        >
          {t("changeQuantity")}
        </button>
        <button
          type="button"
          onClick={() => { onConsume(item.id); onClose(); }}
          className="w-full px-4 py-3 text-left text-sm text-aldi-text transition-colors hover:bg-gray-50"
        >
          {t("swipeConsumed")}
        </button>
        <button
          type="button"
          onClick={() => { onConsumeAndAddToList(item.id); onClose(); }}
          className="w-full px-4 py-3 text-left text-sm text-aldi-blue transition-colors hover:bg-blue-50"
        >
          {t("consumeAndAddToListAction")}
        </button>
        <button
          type="button"
          onClick={() => { onDelete(item.id); onClose(); }}
          className="w-full border-t border-aldi-muted-light px-4 py-3 text-left text-sm text-red-600 transition-colors hover:bg-red-50"
        >
          {t("delete")}
        </button>
      </div>
    </div>
  );
}
