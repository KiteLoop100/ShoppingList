"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { useLocale } from "next-intl";
import { FlyerPageImage } from "@/app/[locale]/flyer/flyer-page-image";

interface FlyerRow {
  flyer_id: string;
  title: string;
  valid_from: string;
  valid_until: string;
  status: string;
  total_pages: number;
  first_page_image_url: string | null;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  return `${day}.${month}.${year}`;
}

export default function FlyerOverviewPage() {
  const t = useTranslations("flyer");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const locale = useLocale();
  const [flyers, setFlyers] = useState<FlyerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClientIfConfigured();
    if (!supabase) {
      setLoading(false);
      return;
    }
    (async () => {
      const { data: flyersData } = await supabase
        .from("flyers")
        .select("flyer_id, title, valid_from, valid_until, status, total_pages")
        .order("created_at", { ascending: false });
      if (!flyersData?.length) {
        setFlyers([]);
        setLoading(false);
        return;
      }
      const flyerIds = flyersData.map((f) => f.flyer_id);
      const { data: pagesData } = await supabase
        .from("flyer_pages")
        .select("flyer_id, image_url")
        .eq("page_number", 1)
        .in("flyer_id", flyerIds);
      const firstPageByFlyer = new Map<string, string | null>();
      for (const p of pagesData ?? []) {
        firstPageByFlyer.set(p.flyer_id, p.image_url ?? null);
      }
      const rows: FlyerRow[] = flyersData.map((f) => ({
        ...f,
        first_page_image_url: firstPageByFlyer.get(f.flyer_id) ?? null,
      }));
      setFlyers(rows);
      setLoading(false);
    })();
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-white">
      <header className="flex shrink-0 items-center gap-3 border-b border-aldi-muted-light bg-white px-4 py-3">
        <button
          type="button"
          className="touch-target -ml-1 flex items-center justify-center rounded-lg text-aldi-blue transition-colors hover:bg-aldi-muted-light/50"
          onClick={() => router.back()}
          aria-label={tCommon("back")}
        >
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="flex-1 text-lg font-bold text-aldi-blue">{t("title")}</h1>
      </header>

      <div className="flex-1 overflow-auto p-4">
        {loading ? (
          <p className="py-8 text-center text-aldi-muted">{tCommon("loading")}</p>
        ) : flyers.length === 0 ? (
          <p className="py-8 text-center text-aldi-muted">{t("noFlyers")}</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {flyers.map((flyer) => {
              const isExpired = flyer.status === "expired";
              return (
                <li key={flyer.flyer_id}>
                  <button
                    type="button"
                    className={`w-full overflow-hidden rounded-xl border border-aldi-muted-light bg-white text-left shadow-sm transition-opacity ${
                      isExpired ? "opacity-60" : "hover:border-aldi-blue/30"
                    }`}
                    onClick={() => router.push(`/flyer/${flyer.flyer_id}`)}
                  >
                    <div className="p-3 pb-2">
                      <h2 className="font-semibold text-aldi-text">{flyer.title}</h2>
                      <p className="text-sm text-aldi-muted">
                        {t("validFrom", { date: formatDate(flyer.valid_from) })} –{" "}
                        {t("validUntil", { date: formatDate(flyer.valid_until) })}
                      </p>
                    </div>
                    {flyer.first_page_image_url ? (
                      <FlyerPageImage
                        imageUrl={flyer.first_page_image_url}
                        className="h-auto w-full object-contain"
                        alt=""
                      />
                    ) : (
                      <div className="flex h-40 w-full items-center justify-center bg-aldi-muted-light/30 text-aldi-muted">
                        {flyer.total_pages} {locale === "de" ? "Seiten" : "pages"}
                      </div>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
