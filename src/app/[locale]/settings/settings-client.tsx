"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/lib/i18n/navigation";
import { getStoresSorted } from "@/lib/store/store-service";
import { getDefaultStoreId, setDefaultStoreId } from "@/lib/settings/default-store";
import { APP_VERSION } from "@/lib/app-config";
import type { LocalStore } from "@/lib/db";

type Locale = "de" | "en";

export function SettingsClient() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const locale = useLocale() as Locale;
  const router = useRouter();
  const pathname = usePathname();

  const [stores, setStores] = useState<LocalStore[]>([]);
  const [defaultStoreId, setDefaultStoreIdState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    setDefaultStoreIdState(getDefaultStoreId());
    setLoading(false);
  }, []);

  const handleLanguageChange = useCallback(
    (newLocale: Locale) => {
      if (newLocale === locale) return;
      router.replace(pathname, { locale: newLocale });
    },
    [locale, pathname, router]
  );

  const handleDefaultStoreChange = useCallback((storeId: string) => {
    const value = storeId === "" ? null : storeId;
    setDefaultStoreId(value);
    setDefaultStoreIdState(value);
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-white p-4">
      <header className="mb-8 flex items-center gap-3">
        <Link
          href="/"
          className="touch-target flex items-center justify-center rounded-lg font-medium text-aldi-blue transition-colors hover:bg-aldi-muted-light/50"
          aria-label={tCommon("back")}
        >
          ←
        </Link>
        <h1 className="text-xl font-bold text-aldi-blue">{t("title")}</h1>
      </header>

      <section className="space-y-8">
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
            <p className="text-sm text-aldi-muted">{tCommon("loading")}</p>
          ) : (
            <select
              value={defaultStoreId ?? ""}
              onChange={(e) => handleDefaultStoreChange(e.target.value)}
              className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] text-aldi-text focus:border-aldi-blue focus:outline-none"
              aria-label={t("defaultStore")}
            >
              <option value="">{t("noDefaultStore")}</option>
              {stores.map((s) => (
                <option key={s.store_id} value={s.store_id}>
                  {s.name} – {s.address}
                </option>
              ))}
            </select>
          )}
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
      </section>
    </main>
  );
}
