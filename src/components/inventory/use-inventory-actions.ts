"use client";

import { useCallback } from "react";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";
import { log } from "@/lib/utils/logger";
import {
  consumeInventoryItem,
  openInventoryItem,
  updateQuantity,
  removeInventoryItem,
  unconsume,
  upsertInventoryItem,
  freezeInventoryItem,
  thawInventoryItem,
  sealInventoryItem,
} from "@/lib/inventory/inventory-service";
import type { InventoryItem } from "@/lib/inventory/inventory-types";
import type { InventoryUpsertInput } from "@/lib/inventory/inventory-types";

type SetItems = React.Dispatch<React.SetStateAction<InventoryItem[]>>;
type ShowToast = (message: string, undoId?: string, prevStatus?: "sealed" | "opened") => void;
type T = (key: string, values?: Record<string, string>) => string;

interface UseInventoryActionsOptions {
  items: InventoryItem[];
  setItems: SetItems;
  showToast: ShowToast;
  fetchItems: () => Promise<void>;
  t: T;
}

export function useInventoryActions({ items, setItems, showToast, fetchItems, t }: UseInventoryActionsOptions) {
  const handleConsume = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    const prevStatus = item.status as "sealed" | "opened";
    setItems((prev) => prev.filter((i) => i.id !== id));
    const ok = await consumeInventoryItem(supabase, id);
    if (ok) {
      showToast(t("consumedToast", { name: item.display_name }), id, prevStatus);
    } else {
      setItems((prev) => [...prev, item]);
    }
  }, [items, t, showToast, setItems]);

  const handleUndo = useCallback(async (itemId: string, prevStatus: "sealed" | "opened") => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;
    const ok = await unconsume(supabase, itemId, prevStatus);
    if (ok) {
      fetchItems();
    } else {
      showToast(t("undoFailed"));
    }
  }, [fetchItems, showToast, t]);

  const handleOpen = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.status === "opened") return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "opened" as const, opened_at: new Date().toISOString() } : i));
    try {
      const ok = await openInventoryItem(supabase, id);
      if (ok) {
        showToast(t("openedToast", { name: item.display_name }));
      } else {
        fetchItems();
      }
    } catch (e) {
      log.warn("[inventory] handleOpen failed:", e);
      fetchItems();
    }
  }, [items, t, showToast, fetchItems, setItems]);

  const handleSeal = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.status !== "opened") return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    setItems((prev) => prev.map((i) => i.id === id ? { ...i, status: "sealed" as const, opened_at: null } : i));
    const ok = await sealInventoryItem(supabase, id);
    if (ok) {
      showToast(t("sealedToast", { name: item.display_name }));
    } else {
      fetchItems();
    }
  }, [items, t, showToast, fetchItems, setItems]);

  const handleQuantityChange = useCallback(async (id: string, qty: number) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;
    const prevQty = items.find((i) => i.id === id)?.quantity;
    setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: qty } : i));
    const ok = await updateQuantity(supabase, id, qty);
    if (!ok && prevQty !== undefined) {
      setItems((prev) => prev.map((i) => i.id === id ? { ...i, quantity: prevQty } : i));
    }
  }, [items, setItems]);

  const handleDelete = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item) return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    setItems((prev) => prev.filter((i) => i.id !== id));
    const ok = await removeInventoryItem(supabase, id);
    if (!ok) {
      setItems((prev) => [...prev, item]);
    }
  }, [items, setItems]);

  const handleFreeze = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || item.is_frozen) return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_frozen: true, frozen_at: new Date().toISOString() } : i));
    const ok = await freezeInventoryItem(supabase, id, item);
    if (ok) {
      showToast(t("frozenToast", { name: item.display_name }));
    } else {
      fetchItems();
    }
  }, [items, t, showToast, fetchItems, setItems]);

  const handleThaw = useCallback(async (id: string) => {
    const item = items.find((i) => i.id === id);
    if (!item || !item.is_frozen) return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    setItems((prev) => prev.map((i) => i.id === id ? { ...i, is_frozen: false, thawed_at: new Date().toISOString() } : i));
    const ok = await thawInventoryItem(supabase, id, item.demand_group_code, item);
    if (ok) {
      showToast(t("thawedToast", { name: item.display_name }));
      fetchItems();
    } else {
      fetchItems();
    }
  }, [items, t, showToast, fetchItems, setItems]);

  const handleAddToInventory = useCallback(async (input: InventoryUpsertInput) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;
    const userId = getCurrentUserId();
    const result = await upsertInventoryItem(supabase, userId, input);
    if (result) {
      showToast(t("restockedToast", { name: input.display_name, count: String(result.quantity) }));
      fetchItems();
    }
  }, [fetchItems, showToast, t]);

  return {
    handleConsume,
    handleUndo,
    handleOpen,
    handleSeal,
    handleQuantityChange,
    handleDelete,
    handleFreeze,
    handleThaw,
    handleAddToInventory,
  };
}
