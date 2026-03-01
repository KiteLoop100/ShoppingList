"use client";

import { useState, useCallback, useRef } from "react";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { getCurrentUserId } from "@/lib/auth/auth-context";

export type ReorderUnit = "days" | "weeks" | "months";

export function computeNextReorderDate(
  lastCheckedAt: string | null,
  value: number,
  unit: ReorderUnit
): string | null {
  if (!lastCheckedAt) return null;
  const d = new Date(lastCheckedAt);
  if (unit === "days") d.setDate(d.getDate() + value);
  else if (unit === "weeks") d.setDate(d.getDate() + value * 7);
  else d.setMonth(d.getMonth() + value);
  return d.toISOString().slice(0, 10);
}

export interface UseAutoReorderResult {
  reorderEnabled: boolean;
  reorderValue: number;
  reorderUnit: ReorderUnit;
  reorderLastChecked: string | null;
  reorderLoading: boolean;
  nextReorderDate: string | null;
  loadReorderSetting: (productId: string) => Promise<void>;
  handleToggleReorder: () => Promise<void>;
  handleValueChange: (newValue: number) => Promise<void>;
  handleUnitChange: (newUnit: ReorderUnit) => Promise<void>;
}

export function useAutoReorder(onChanged?: () => void): UseAutoReorderResult {
  const [reorderEnabled, setReorderEnabled] = useState(false);
  const [reorderValue, setReorderValue] = useState(1);
  const [reorderUnit, setReorderUnit] = useState<ReorderUnit>("weeks");
  const [reorderLastChecked, setReorderLastChecked] = useState<string | null>(null);
  const [reorderLoading, setReorderLoading] = useState(false);
  const [reorderSettingId, setReorderSettingId] = useState<string | null>(null);
  const productIdRef = useRef<string | null>(null);

  const loadReorderSetting = useCallback(async (productId: string) => {
    productIdRef.current = productId;
    const supabase = createClientIfConfigured();
    if (!supabase) return;
    const userId = getCurrentUserId();
    const { data } = await supabase
      .from("auto_reorder_settings")
      .select("id, reorder_value, reorder_unit, last_checked_at, is_active")
      .eq("user_id", userId)
      .eq("product_id", productId)
      .maybeSingle();
    if (data && data.is_active) {
      setReorderEnabled(true);
      setReorderValue(data.reorder_value);
      setReorderUnit(data.reorder_unit as ReorderUnit);
      setReorderLastChecked(data.last_checked_at);
      setReorderSettingId(data.id);
    } else {
      setReorderEnabled(false);
      setReorderValue(1);
      setReorderUnit("weeks");
      setReorderLastChecked(null);
      setReorderSettingId(data?.id ?? null);
    }
  }, []);

  const saveReorderSetting = useCallback(
    async (enabled: boolean, value: number, unit: ReorderUnit) => {
      const productId = productIdRef.current;
      if (!productId) return;
      const supabase = createClientIfConfigured();
      if (!supabase) return;
      setReorderLoading(true);
      const userId = getCurrentUserId();
      try {
        if (reorderSettingId) {
          await supabase
            .from("auto_reorder_settings")
            .update({ is_active: enabled, reorder_value: value, reorder_unit: unit })
            .eq("id", reorderSettingId);
        } else if (enabled) {
          const { data } = await supabase
            .from("auto_reorder_settings")
            .insert({
              user_id: userId,
              product_id: productId,
              reorder_value: value,
              reorder_unit: unit,
              is_active: true,
            })
            .select("id")
            .single();
          if (data) setReorderSettingId(data.id);
        }
        onChanged?.();
      } finally {
        setReorderLoading(false);
      }
    },
    [reorderSettingId, onChanged]
  );

  const handleToggleReorder = useCallback(async () => {
    const newEnabled = !reorderEnabled;
    setReorderEnabled(newEnabled);
    await saveReorderSetting(newEnabled, reorderValue, reorderUnit);
  }, [reorderEnabled, reorderValue, reorderUnit, saveReorderSetting]);

  const handleValueChange = useCallback(
    async (newValue: number) => {
      setReorderValue(newValue);
      if (reorderEnabled) {
        await saveReorderSetting(true, newValue, reorderUnit);
      }
    },
    [reorderEnabled, reorderUnit, saveReorderSetting]
  );

  const handleUnitChange = useCallback(
    async (newUnit: ReorderUnit) => {
      setReorderUnit(newUnit);
      if (reorderEnabled) {
        await saveReorderSetting(true, reorderValue, newUnit);
      }
    },
    [reorderEnabled, reorderValue, saveReorderSetting]
  );

  const nextReorderDate = reorderEnabled
    ? computeNextReorderDate(reorderLastChecked, reorderValue, reorderUnit)
    : null;

  return {
    reorderEnabled,
    reorderValue,
    reorderUnit,
    reorderLastChecked,
    reorderLoading,
    nextReorderDate,
    loadReorderSetting,
    handleToggleReorder,
    handleValueChange,
    handleUnitChange,
  };
}
