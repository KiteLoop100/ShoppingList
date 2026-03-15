"use client";

import { useState, useCallback } from "react";
import { createClientIfConfigured } from "@/lib/supabase/client";
import {
  updateReceiptItemArticleNumber,
  type GroupedReceiptItem,
  type ArticleNumberUpdateResult,
} from "@/lib/receipts/receipt-service";
import { log } from "@/lib/utils/logger";

export interface ArticleNumberEditState {
  editItem: GroupedReceiptItem | null;
  saving: boolean;
  openEdit: (item: GroupedReceiptItem) => void;
  closeEdit: () => void;
  saveEdit: (
    newNumber: string,
    purchaseDate?: string | null,
  ) => Promise<ArticleNumberUpdateResult | null>;
}

export function useArticleNumberEdit(
  onSaved?: () => void,
): ArticleNumberEditState {
  const [editItem, setEditItem] = useState<GroupedReceiptItem | null>(null);
  const [saving, setSaving] = useState(false);

  const openEdit = useCallback((item: GroupedReceiptItem) => {
    setEditItem(item);
  }, []);

  const closeEdit = useCallback(() => {
    setEditItem(null);
  }, []);

  const saveEdit = useCallback(
    async (
      newNumber: string,
      purchaseDate?: string | null,
    ): Promise<ArticleNumberUpdateResult | null> => {
      if (!editItem) return null;
      setSaving(true);
      try {
        const supabase = createClientIfConfigured();
        if (!supabase) return null;
        const itemIds = editItem.original_item_ids ?? [editItem.receipt_item_id];
        const itemPrice = editItem.unit_price ?? editItem.total_price;
        const result = await updateReceiptItemArticleNumber(
          itemIds, newNumber, supabase, purchaseDate, itemPrice,
        );
        setEditItem(null);
        onSaved?.();
        return result;
      } catch (e) {
        log.warn("[receipts] Article number update failed:", e);
        return null;
      } finally {
        setSaving(false);
      }
    },
    [editItem, onSaved],
  );

  return { editItem, saving, openEdit, closeEdit, saveEdit };
}
