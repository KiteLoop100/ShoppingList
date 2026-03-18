"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "@/lib/i18n/navigation";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { useCurrentCountry } from "@/lib/current-country-context";
import { FlyerPageImage } from "@/app/[locale]/flyer/flyer-page-image";
import { formatFlyerDate } from "@/lib/utils/format-date";
import { CardSkeleton } from "@/components/ui/skeleton";

interface FlyerRow {
  flyer_id: string;
  title: string;
  valid_from: string;
  valid_until: string;
  status: string;
  total_pages: number;
  first_page_image_url: string | null;
  created_at?: string;
}

export function FlyerOverviewClientPage() {
  const t = useTranslations("flyer");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const { country } = useCurrentCountry();
  const [flyers, setFlyers] = useState<FlyerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClientIfConfigured();
    if (!supabase) {
      setLoading(false);
      return;
    }
    (async () => {
      try {
        const countryCode = country ?? "DE";
        const [flyersResult, pagesResult] = await Promise.all([
          supabase
            .from("flyers")
            .select("flyer_id, title, valid_from, valid_until, status, total_pages, created_at")
            .eq("country", countryCode)
            .order("valid_until", { ascending: false })
            .order("created_at", { ascending: false }),
          supabase
            .from("flyer_pages")
            .select("flyer_id, image_url")
            .eq("page_number", 1),
        ]);
        if (cancelled) return;
        const flyersData = flyersResult.data;
        if (!flyersData?.length) {
          setFlyers([]);
          setLoading(false);
          return;
        }
        const flyerIdSet = new Set(flyersData.map((f) => f.flyer_id));
        const firstPageByFlyer = new Map<string, string | null>();
        for (const p of pagesResult.data ?? []) {
          if (flyerIdSet.has(p.flyer_id)) {
            firstPageByFlyer.set(p.flyer_id, p.image_url ?? null);
          }
        }
        const sorted: FlyerRow[] = flyersData
          .map((f) => ({
            ...f,
            first_page_image_url: firstPageByFlyer.get(f.flyer_id) ?? null,
          }))
          .sort((a, b) => {
            const untilA = a.valid_until || "";
            const untilB = b.valid_until || "";
            if (untilB !== untilA) return untilB.localeCompare(untilA);
            return (b.created_at ?? "").localeCompare(a.created_at ?? "");
          });

        const seen = new Set<string>();
        const rows = sorted.filter((f) => {
          const key = `${f.valid_from}|${f.valid_until}|${f.total_pages}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // #region agent log
        fetch('http://127.0.0.1:7547/ingest/d58e5f1a-49bc-422a-bf52-4fc861b26370',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2cfb9'},body:JSON.stringify({sessionId:'c2cfb9',location:'flyer-overview-client.tsx:dedup',message:'Flyers after dedup',data:{before:sorted.length,after:rows.length,flyers:rows.map(f=>({id:f.flyer_id,title:f.title,from:f.valid_from,until:f.valid_until,status:f.status,pages:f.total_pages}))},timestamp:Date.now(),runId:'post-fix',hypothesisId:'B'})}).catch(()=>{});
        // #endregion
        if (!cancelled) {
          setFlyers(rows);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setFlyers([]);
          setLoading(false);
        }
      }
    })();
    return () => { cancelled = true; };
  }, [country]);

  return (
    <main className="mx-auto flex h-dvh max-w-lg flex-col overflow-hidden bg-aldi-bg md:max-w-3xl lg:max-w-5xl">
      <header className="sticky top-0 z-10 flex shrink-0 items-center gap-3 bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)] md:px-6 lg:px-8">
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

      <div className="min-h-0 flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        {loading ? (
          <div className="flex flex-col gap-4">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : flyers.length === 0 ? (
          <div className="flex flex-col items-center gap-4 py-8 lg:py-16">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-aldi-blue-light lg:h-20 lg:w-20">
              <svg className="h-8 w-8 text-aldi-blue lg:h-10 lg:w-10" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 01-2.25 2.25M16.5 7.5V18a2.25 2.25 0 002.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 002.25 2.25h13.5M6 7.5h3v3H6v-3z" />
              </svg>
            </div>
            <p className="text-sm text-aldi-muted lg:text-base">{t("noFlyers")}</p>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {flyers.map((flyer) => {
              const today = new Date().toISOString().slice(0, 10);
              const isExpired = flyer.valid_until < today;
              // #region agent log
              fetch('http://127.0.0.1:7547/ingest/d58e5f1a-49bc-422a-bf52-4fc861b26370',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'c2cfb9'},body:JSON.stringify({sessionId:'c2cfb9',location:'flyer-overview-client.tsx:render',message:'Render flyer card',data:{id:flyer.flyer_id,title:flyer.title,status:flyer.status,isExpired,valid_until:flyer.valid_until,today},timestamp:Date.now(),runId:'post-fix',hypothesisId:'A'})}).catch(()=>{});
              // #endregion
              return (
                <li key={flyer.flyer_id}>
                  <button
                    type="button"
                    className={`w-full overflow-hidden rounded-xl border border-aldi-muted-light bg-white text-left shadow-sm transition-all ${
                      isExpired ? "opacity-60" : "pointer-fine:hover:shadow-md pointer-fine:hover:border-aldi-blue/30"
                    }`}
                    onClick={() => router.push(`/flyer/${flyer.flyer_id}`)}
                  >
                    <div className="p-3 pb-2">
                      <h2 className="font-semibold text-aldi-text">{flyer.title}</h2>
                      <p className="text-sm text-aldi-muted">
                        {t("validFrom", { date: formatFlyerDate(flyer.valid_from) })} -{" "}
                        {t("validUntil", { date: formatFlyerDate(flyer.valid_until) })}
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
                        {flyer.total_pages} {t("pages")}
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
