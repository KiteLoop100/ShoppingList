"use client";

import { useTranslations } from "next-intl";
import type { LocalSortingError } from "@/lib/db";

interface SortingErrorsPanelProps {
  errors: LocalSortingError[];
  stores: { store_id: string; name: string }[];
}

export function SortingErrorsPanel({ errors, stores }: SortingErrorsPanelProps) {
  const t = useTranslations("admin");

  const getStoreName = (store_id: string) =>
    stores.find((s) => s.store_id === store_id)?.name ?? store_id;

  return (
    <section className="space-y-6">
      <h2 className="text-lg font-bold text-aldi-blue">{t("errors")}</h2>
      <div className="overflow-hidden rounded-xl border-2 border-aldi-muted-light">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-aldi-blue/10">
              <th className="p-3 text-left font-semibold text-aldi-blue">{t("store")}</th>
              <th className="p-3 text-left font-semibold text-aldi-blue">{t("reportedAt")}</th>
              <th className="p-3 text-left font-semibold text-aldi-blue">{t("sortOrder")}</th>
              <th className="p-3 font-semibold text-aldi-blue">{t("status")}</th>
            </tr>
          </thead>
          <tbody>
            {errors.map((e) => (
              <tr key={e.error_id} className="border-t border-aldi-muted-light">
                <td className="p-3 font-medium">{getStoreName(e.store_id)}</td>
                <td className="p-3 text-aldi-muted">{new Date(e.reported_at).toLocaleString()}</td>
                <td className="p-3">
                  <pre className="max-w-md overflow-auto whitespace-pre-wrap text-xs">
                    {JSON.stringify(e.current_sort_order, null, 2)}
                  </pre>
                </td>
                <td className="p-3">{e.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {errors.length === 0 && <p className="text-aldi-muted">{t("noErrors")}</p>}
    </section>
  );
}
