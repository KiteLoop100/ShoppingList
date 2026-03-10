"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/lib/i18n/navigation";
import { getStoresSorted } from "@/lib/store/store-service";
import { getDefaultStoreId, setDefaultStoreId } from "@/lib/settings/default-store";
import {
  getProductPreferences,
  setProductPreferences,
  type ProductPreferences,
} from "@/lib/settings/product-preferences";
import { APP_VERSION } from "@/lib/app-config";
import { useAuth } from "@/lib/auth/auth-context";
import { loadSettings, saveSettings, isInventoryEnabled } from "@/lib/settings/settings-sync";
import { backfillFromReceipts } from "@/lib/inventory/inventory-service";
import { log } from "@/lib/utils/logger";
import { queryGeolocationPermission } from "@/lib/geo/gps-permission";
import { createClientIfConfigured } from "@/lib/supabase/client";
import type { LocalStore } from "@/lib/db";
import { normalizeForFilter, filterAndSortStores } from "@/lib/store/store-filter";
import { useCurrentCountry } from "@/lib/current-country-context";
import { SettingsSkeleton } from "@/components/ui/skeleton";

type Locale = "de" | "en";

export function SettingsClient() {
  const t = useTranslations("settings");
  const tAuth = useTranslations("auth");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAnonymous, signOut, loading: authLoading } = useAuth();
  const { setCountry } = useCurrentCountry();

  const [stores, setStores] = useState<LocalStore[]>([]);
  const [defaultStoreId, setDefaultStoreIdState] = useState<string | null>(null);
  const [gpsEnabled, setGpsEnabled] = useState(true);
  const [gpsBrowserDenied, setGpsBrowserDenied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [storeSearchQuery, setStoreSearchQuery] = useState("");
  const [prefs, setPrefs] = useState<ProductPreferences>(getProductPreferences);
  const [inventoryEnabled, setInventoryEnabled] = useState(false);
  const [showBackfillDialog, setShowBackfillDialog] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [receiptCountForBackfill, setReceiptCountForBackfill] = useState(0);

  useEffect(() => {
    let cancelled = false;
    getStoresSorted().then((list) => {
      if (!cancelled) setStores(list);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    let cancelled = false;
    const userId = user?.id ?? "anonymous";

    loadSettings(userId).then((s) => {
      if (cancelled) return;
      if (s.default_store_id) {
        setDefaultStoreId(s.default_store_id);
        setDefaultStoreIdState(s.default_store_id);
      } else {
        setDefaultStoreIdState(getDefaultStoreId());
      }
      setGpsEnabled(s.gps_enabled);
      setPrefs({
        exclude_gluten: s.exclude_gluten,
        exclude_lactose: s.exclude_lactose,
        exclude_nuts: s.exclude_nuts,
        prefer_cheapest: s.prefer_cheapest,
        prefer_brand: s.prefer_brand,
        prefer_bio: s.prefer_bio,
        prefer_vegan: s.prefer_vegan,
        prefer_animal_welfare: s.prefer_animal_welfare,
      });
      setProductPreferences({
        exclude_gluten: s.exclude_gluten,
        exclude_lactose: s.exclude_lactose,
        exclude_nuts: s.exclude_nuts,
        prefer_cheapest: s.prefer_cheapest,
        prefer_brand: s.prefer_brand,
        prefer_bio: s.prefer_bio,
        prefer_vegan: s.prefer_vegan,
        prefer_animal_welfare: s.prefer_animal_welfare,
      });
      setInventoryEnabled(s.enable_inventory);
      setLoading(false);
    });

    return () => { cancelled = true; };
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (authLoading || !user?.id) return;
    const supabase = createClientIfConfigured();
    if (!supabase) return;

    const channel = supabase
      .channel(`user-settings-${user.id}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "user_settings",
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const s = payload.new as Record<string, unknown>;
          if (s.default_store_id !== undefined) {
            const storeId = (s.default_store_id as string | null) ?? null;
            setDefaultStoreId(storeId);
            setDefaultStoreIdState(storeId);
          }
          if (s.gps_enabled !== undefined) {
            setGpsEnabled(Boolean(s.gps_enabled));
          }
          const nextPrefs: ProductPreferences = {
            exclude_gluten: Boolean(s.exclude_gluten),
            exclude_lactose: Boolean(s.exclude_lactose),
            exclude_nuts: Boolean(s.exclude_nuts),
            prefer_cheapest: Boolean(s.prefer_cheapest),
            prefer_brand: Boolean(s.prefer_brand),
            prefer_bio: Boolean(s.prefer_bio),
            prefer_vegan: Boolean(s.prefer_vegan),
            prefer_animal_welfare: Boolean(s.prefer_animal_welfare),
          };
          setPrefs(nextPrefs);
          setProductPreferences(nextPrefs);
          if (s.enable_inventory !== undefined) {
            setInventoryEnabled(Boolean(s.enable_inventory));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [authLoading, user?.id]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setDefaultStoreIdState(getDefaultStoreId());
      }
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  const handleLanguageChange = useCallback(
    (newLocale: Locale) => {
      if (newLocale === locale) return;
      saveSettings({ preferred_language: newLocale }, user?.id).catch(() => {});
      router.replace(pathname, { locale: newLocale });
    },
    [locale, pathname, router, user?.id]
  );

  const handleDefaultStoreChange = useCallback((storeId: string | null) => {
    const value = storeId ?? null;
    setDefaultStoreId(value);
    setDefaultStoreIdState(value);
    saveSettings({
      preferred_language: locale,
      default_store_id: value,
      ...prefs,
    }, user?.id).catch(() => {});
    const selected = value ? stores.find((s) => s.store_id === value) : null;
    setCountry(selected?.country?.toUpperCase() ?? "DE");
  }, [locale, prefs, user?.id, stores, setCountry]);

  const handleGpsToggle = useCallback(async (enabled: boolean) => {
    if (enabled) {
      const browserPerm = await queryGeolocationPermission();
      if (browserPerm === "denied") {
        setGpsBrowserDenied(true);
        setTimeout(() => setGpsBrowserDenied(false), 5000);
        return;
      }
    }
    setGpsEnabled(enabled);
    saveSettings({ gps_enabled: enabled }, user?.id).catch(() => {});
  }, [user?.id]);

  const handleInventoryToggle = useCallback(async (enabled: boolean) => {
    setInventoryEnabled(enabled);
    saveSettings({ enable_inventory: enabled }, user?.id).catch(() => {});

    if (enabled && !inventoryEnabled) {
      const supabase = createClientIfConfigured();
      if (supabase && user?.id) {
        const { count } = await supabase
          .from("receipts")
          .select("receipt_id", { count: "exact", head: true })
          .eq("user_id", user.id);
        if (count && count > 0) {
          setReceiptCountForBackfill(count);
          setShowBackfillDialog(true);
        }
      }
    }
  }, [inventoryEnabled, user?.id]);

  const handleBackfill = useCallback(async (doBackfill: boolean) => {
    setShowBackfillDialog(false);
    if (!doBackfill) return;

    const supabase = createClientIfConfigured();
    if (!supabase || !user?.id) return;

    setBackfilling(true);
    try {
      await backfillFromReceipts(supabase, user.id, 4);
    } catch (e) {
      log.warn("[settings] backfill failed:", e);
    } finally {
      setBackfilling(false);
    }
  }, [user?.id]);

  const saveSettingsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debouncedSaveSettings = useCallback(
    (settings: Parameters<typeof saveSettings>[0], userId?: string) => {
      if (saveSettingsTimerRef.current) clearTimeout(saveSettingsTimerRef.current);
      saveSettingsTimerRef.current = setTimeout(() => {
        saveSettingsTimerRef.current = null;
        saveSettings(settings, userId).catch(() => {});
      }, 500);
    },
    []
  );

  useEffect(() => {
    return () => {
      if (saveSettingsTimerRef.current) clearTimeout(saveSettingsTimerRef.current);
    };
  }, []);

  const updatePref = useCallback(<K extends keyof ProductPreferences>(key: K, value: ProductPreferences[K]) => {
    setPrefs((prev) => {
      const next = { ...prev, [key]: value };
      if (key === "prefer_cheapest" && value) {
        next.prefer_bio = false;
        next.prefer_vegan = false;
        next.prefer_animal_welfare = false;
        next.prefer_brand = false;
      } else if ((key === "prefer_bio" || key === "prefer_vegan" || key === "prefer_animal_welfare" || key === "prefer_brand") && value) {
        next.prefer_cheapest = false;
      }
      setProductPreferences(next);
      debouncedSaveSettings({
        preferred_language: locale,
        default_store_id: defaultStoreId,
        ...next,
      }, user?.id);
      return next;
    });
  }, [locale, defaultStoreId, user?.id, debouncedSaveSettings]);

  const qualityActive = prefs.prefer_bio || prefs.prefer_vegan || prefs.prefer_animal_welfare || prefs.prefer_brand;

  const storeSearchNorm = normalizeForFilter(storeSearchQuery);
  const filteredStores = useMemo(
    () => filterAndSortStores(stores, storeSearchNorm),
    [stores, storeSearchNorm]
  );

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-aldi-bg p-4 md:max-w-2xl md:p-6 lg:p-8">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 bg-aldi-bg px-4 py-3">
        <Link
          href="/"
          className="touch-target flex items-center justify-center rounded-lg font-medium text-aldi-blue transition-colors hover:bg-aldi-muted-light/50"
          aria-label={tCommon("back")}
        >
          ←
        </Link>
        <h1 className="text-xl font-bold text-aldi-blue">{t("title")}</h1>
      </header>

      <section className="space-y-8 pt-2">
        {/* Account section */}
        <div className="rounded-2xl border-2 border-aldi-muted-light bg-white p-4">
          <label className="mb-3 block text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {tAuth("accountSection")}
          </label>
          {authLoading ? (
            <p className="text-sm text-aldi-muted">{tCommon("loading")}</p>
          ) : !user || isAnonymous ? (
            <div>
              <p className="mb-3 text-sm text-aldi-text">{tAuth("anonymousHint")}</p>
              <Link
                href="/login"
                className="min-h-touch flex w-full items-center justify-center rounded-xl bg-aldi-blue px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-aldi-blue/90"
              >
                {tAuth("createOrLogin")}
              </Link>
            </div>
          ) : (
            <div>
              <p className="mb-3 text-sm text-aldi-text">
                {tAuth("loggedInAs", { email: user.email ?? "–" })}
              </p>
              <button
                type="button"
                onClick={async () => {
                  await signOut();
                  router.push("/login");
                }}
                className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] font-medium text-aldi-text transition-colors hover:border-aldi-error hover:bg-red-50 hover:text-aldi-error"
              >
                {tAuth("signOut")}
              </button>
            </div>
          )}
        </div>

        <hr className="border-aldi-muted-light" />

        <div>
          <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("language")}
          </label>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => handleLanguageChange("de")}
              className={`min-h-touch min-w-[120px] rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                locale === "de"
                  ? "border-aldi-blue bg-aldi-blue text-white"
                  : "border-aldi-muted-light bg-white text-aldi-text hover:border-aldi-blue/50 hover:bg-aldi-muted-light/30"
              }`}
            >
              {t("languageDe")}
            </button>
            <button
              type="button"
              onClick={() => handleLanguageChange("en")}
              className={`min-h-touch min-w-[120px] rounded-xl border-2 px-4 py-3 text-sm font-semibold transition-colors ${
                locale === "en"
                  ? "border-aldi-blue bg-aldi-blue text-white"
                  : "border-aldi-muted-light bg-white text-aldi-text hover:border-aldi-blue/50 hover:bg-aldi-muted-light/30"
              }`}
            >
              {t("languageEn")}
            </button>
          </div>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("defaultStore")}
          </label>
          <p className="mb-3 text-sm text-aldi-muted">{t("defaultStoreHint")}</p>
          {loading ? (
            <SettingsSkeleton />
          ) : (
            <>
              {defaultStoreId && (() => {
                const selected = stores.find((s) => s.store_id === defaultStoreId);
                if (!selected) return null;
                return (
                  <div className="mb-3 flex items-center gap-3 rounded-xl border-2 border-aldi-blue bg-aldi-blue/5 px-4 py-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-aldi-blue text-sm font-bold text-white">
                      ✓
                    </div>
                    <div className="min-w-0 flex-1">
                      {selected.retailer && (
                        <p className="truncate text-[11px] font-bold uppercase tracking-wider text-aldi-blue/70">{selected.retailer}</p>
                      )}
                      {selected.country !== "DE" && selected.country !== "AT" && (
                        <p className="truncate text-xs font-semibold text-aldi-blue">{selected.name}</p>
                      )}
                      <p className="truncate text-sm font-semibold text-aldi-blue">{selected.address}</p>
                      <p className="truncate text-xs text-aldi-muted">{selected.postal_code} {selected.city}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDefaultStoreChange(null)}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-aldi-muted transition-colors hover:bg-red-50 hover:text-red-600"
                      aria-label={t("noDefaultStore")}
                    >
                      ✕
                    </button>
                  </div>
                );
              })()}

              <div className="relative">
                <input
                  type="search"
                  value={storeSearchQuery}
                  onChange={(e) => setStoreSearchQuery(e.target.value)}
                  placeholder={t("defaultStoreSearchPlaceholder")}
                  className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:border-aldi-blue focus:outline-none"
                  aria-label={t("defaultStoreSearchPlaceholder")}
                />

                {storeSearchNorm.length > 0 && (
                  <div className="absolute left-0 right-0 top-full z-10 mt-1 overflow-hidden rounded-xl border-2 border-aldi-muted-light bg-white shadow-lg">
                    {filteredStores.length === 0 ? (
                      <p className="px-4 py-4 text-center text-sm text-aldi-muted">
                        {t("noStoresMatchSearch")}
                      </p>
                    ) : (
                      filteredStores.slice(0, 8).map((s) => (
                        <button
                          key={s.store_id}
                          type="button"
                          onClick={() => {
                            handleDefaultStoreChange(s.store_id);
                            setStoreSearchQuery("");
                          }}
                          className="flex w-full items-start gap-3 border-b border-aldi-muted-light px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50"
                        >
                          <div className="min-w-0 flex-1">
                            {s.retailer && (
                              <p className="text-[11px] font-bold uppercase tracking-wider text-aldi-blue/60">{s.retailer}</p>
                            )}
                            {s.country !== "DE" && s.country !== "AT" && (
                              <p className="text-xs font-semibold text-aldi-blue">{s.name}</p>
                            )}
                            <p className="text-sm font-medium text-aldi-text">{s.address}</p>
                            <p className="text-xs text-aldi-muted">{s.postal_code} {s.city}</p>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("gpsDetection")}
          </label>
          <p className="mb-3 text-xs text-aldi-muted">{t("gpsDetectionHint")}</p>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 transition-colors hover:border-aldi-blue/30">
            <div className="relative inline-flex h-6 w-11 shrink-0 items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={gpsEnabled}
                onChange={(e) => void handleGpsToggle(e.target.checked)}
              />
              <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-aldi-blue peer-focus-visible:ring-2 peer-focus-visible:ring-aldi-blue/50" />
              <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </div>
            <span className="text-sm font-medium text-aldi-text">{t("gpsEnabled")}</span>
          </label>
          {gpsBrowserDenied && (
            <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {t("gpsBrowserDeniedToast")}
            </p>
          )}
        </div>

        <hr className="border-aldi-muted-light" />

        {/* Dietary exclusions */}
        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("exclusions")}
          </label>
          <p className="mb-3 text-xs text-aldi-muted">{t("exclusionsHint")}</p>
          <div className="space-y-2">
            {(["exclude_gluten", "exclude_lactose", "exclude_nuts"] as const).map((key) => {
              const labelKey = key === "exclude_gluten" ? "excludeGluten" : key === "exclude_lactose" ? "excludeLactose" : "excludeNuts";
              return (
                <label key={key} className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 transition-colors hover:border-aldi-blue/30">
                  <div className="relative inline-flex h-6 w-11 shrink-0 items-center">
                    <input
                      type="checkbox"
                      className="peer sr-only"
                      checked={prefs[key]}
                      onChange={(e) => updatePref(key, e.target.checked)}
                    />
                    <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-aldi-blue peer-focus-visible:ring-2 peer-focus-visible:ring-aldi-blue/50" />
                    <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                  </div>
                  <span className="text-sm font-medium text-aldi-text">{t(labelKey)}</span>
                </label>
              );
            })}
          </div>
        </div>

        <hr className="border-aldi-muted-light" />

        {/* Product preferences */}
        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("preferences")}
          </label>
          <p className="mb-3 text-xs text-aldi-muted">{t("preferencesHint")}</p>
          <div className="space-y-2">
            {/* Cheapest — mutually exclusive with quality preferences */}
            <label className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${
              qualityActive
                ? "cursor-not-allowed border-aldi-muted-light/60 bg-gray-50"
                : "cursor-pointer border-aldi-muted-light bg-white hover:border-aldi-blue/30"
            }`}>
              <div className="relative inline-flex h-6 w-11 shrink-0 items-center">
                <input
                  type="checkbox"
                  className="peer sr-only"
                  checked={prefs.prefer_cheapest}
                  disabled={qualityActive}
                  onChange={(e) => updatePref("prefer_cheapest", e.target.checked)}
                />
                <div className={`h-6 w-11 rounded-full transition-colors ${qualityActive ? "bg-gray-100" : "bg-gray-200 peer-checked:bg-aldi-blue"} peer-focus-visible:ring-2 peer-focus-visible:ring-aldi-blue/50`} />
                <div className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow transition-transform peer-checked:translate-x-5 ${qualityActive ? "bg-gray-200" : "bg-white"}`} />
              </div>
              <span className={`text-sm font-medium ${qualityActive ? "text-aldi-muted" : "text-aldi-text"}`}>{t("preferCheapest")}</span>
            </label>

            {/* Quality preferences — mutually exclusive with cheapest */}
            {([
              { key: "prefer_brand" as const, label: "preferBrand" },
              { key: "prefer_bio" as const, label: "preferBio" },
              { key: "prefer_vegan" as const, label: "preferVegan" },
              { key: "prefer_animal_welfare" as const, label: "preferAnimalWelfare" },
            ]).map(({ key, label }) => (
              <label key={key} className={`flex items-center gap-3 rounded-xl border-2 px-4 py-3 transition-colors ${
                prefs.prefer_cheapest
                  ? "cursor-not-allowed border-aldi-muted-light/60 bg-gray-50"
                  : "cursor-pointer border-aldi-muted-light bg-white hover:border-aldi-blue/30"
              }`}>
                <div className="relative inline-flex h-6 w-11 shrink-0 items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={prefs[key]}
                    disabled={prefs.prefer_cheapest}
                    onChange={(e) => updatePref(key, e.target.checked)}
                  />
                  <div className={`h-6 w-11 rounded-full transition-colors ${prefs.prefer_cheapest ? "bg-gray-100" : "bg-gray-200 peer-checked:bg-aldi-blue"} peer-focus-visible:ring-2 peer-focus-visible:ring-aldi-blue/50`} />
                  <div className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full shadow transition-transform peer-checked:translate-x-5 ${prefs.prefer_cheapest ? "bg-gray-200" : "bg-white"}`} />
                </div>
                <span className={`text-sm font-medium ${prefs.prefer_cheapest ? "text-aldi-muted" : "text-aldi-text"}`}>{t(label)}</span>
              </label>
            ))}
          </div>
        </div>

        <hr className="border-aldi-muted-light" />

        {/* Inventory toggle (F42) */}
        <div>
          <label className="mb-1 block text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("inventoryTitle")}
          </label>
          <p className="mb-3 text-xs text-aldi-muted">{t("inventoryHint")}</p>
          <label className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 transition-colors hover:border-aldi-blue/30">
            <div className="relative inline-flex h-6 w-11 shrink-0 items-center">
              <input
                type="checkbox"
                className="peer sr-only"
                checked={inventoryEnabled}
                onChange={(e) => void handleInventoryToggle(e.target.checked)}
              />
              <div className="h-6 w-11 rounded-full bg-gray-200 transition-colors peer-checked:bg-aldi-blue peer-focus-visible:ring-2 peer-focus-visible:ring-aldi-blue/50" />
              <div className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
            </div>
            <span className="text-sm font-medium text-aldi-text">{t("inventoryEnabled")}</span>
          </label>
          {backfilling && (
            <div className="mt-2 flex items-center gap-2 rounded-lg bg-aldi-blue/5 px-3 py-2">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-aldi-blue border-t-transparent" />
              <span className="text-sm text-aldi-blue">{t("inventoryBackfilling")}</span>
            </div>
          )}
        </div>

        {/* Backfill dialog */}
        {showBackfillDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-xl">
              <h3 className="mb-2 text-lg font-semibold text-aldi-text">
                {t("backfillTitle")}
              </h3>
              <p className="mb-4 text-sm text-aldi-muted">
                {t("backfillMessage", { count: receiptCountForBackfill })}
              </p>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleBackfill(true)}
                  className="min-h-touch flex-1 rounded-xl bg-aldi-blue px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-aldi-blue/90"
                >
                  {t("backfillYes")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleBackfill(false)}
                  className="min-h-touch flex-1 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-sm font-medium text-aldi-text transition-colors hover:border-aldi-blue/30"
                >
                  {t("backfillNo")}
                </button>
              </div>
            </div>
          </div>
        )}

        <hr className="border-aldi-muted-light" />

        <div>
          <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("admin")}
          </label>
          <Link
            href="/admin"
            className="min-h-touch flex w-full items-center justify-center rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 font-medium text-aldi-text transition-colors hover:border-aldi-blue hover:bg-aldi-muted-light/30"
          >
            {t("adminLink")}
          </Link>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("appGuide")}
          </label>
          <Link
            href="/?onboarding=true"
            className="min-h-touch flex w-full items-center justify-center gap-2 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 font-medium text-aldi-blue transition-colors hover:border-aldi-blue hover:bg-aldi-blue/5"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
            </svg>
            {t("appGuideLink")}
          </Link>
        </div>

        <hr className="border-aldi-muted-light" />

        <div>
          <label className="mb-2 block text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("feedback")}
          </label>
          <p className="mb-3 text-sm text-aldi-muted">{t("feedbackHint")}</p>
          <Link
            href="/feedback"
            className="min-h-touch flex w-full items-center justify-center gap-2 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 font-medium text-aldi-blue transition-colors hover:border-aldi-blue hover:bg-aldi-blue/5"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
            </svg>
            {t("feedbackButton")}
          </Link>
        </div>

        <hr className="border-aldi-muted-light" />

        <div>
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-aldi-muted">
            {t("about")}
          </h2>
          <p className="text-[15px] font-medium text-aldi-text">
            {t("version", { version: APP_VERSION })}
          </p>
          <p className="mt-0.5 text-sm text-aldi-muted">{t("prototypeNote")}</p>
        </div>

        <hr className="border-aldi-muted-light" />

        <div>
          <Link
            href="/privacy"
            className="min-h-touch flex w-full items-center justify-center gap-2 rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 font-medium text-aldi-blue transition-colors hover:border-aldi-blue hover:bg-aldi-blue/5"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={1.75} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            {t("privacyPolicy")}
          </Link>
        </div>
      </section>
    </main>
  );
}
