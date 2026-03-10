"use client";

import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import { translateDemandGroupName, formatDemandGroupLabel } from "@/lib/i18n/category-translations";
import {
  fetchDemandGroupsFromSupabase,
  fetchDemandSubGroupsFromSupabase,
  buildSubGroupNameMap,
  toDemandGroups,
} from "@/lib/categories/category-service";
import type { DemandGroup } from "@/types";
import { SectionLabel } from "./section-label";

interface CategorySectionProps {
  demandGroupCode: string | null;
  demandSubGroup?: string | null;
  labels: { demandGroup: string; demandSubGroup: string };
}

export function CategorySection({ demandGroupCode, demandSubGroup, labels }: CategorySectionProps) {
  const locale = useLocale();
  const [dgMap, setDgMap] = useState<Map<string, DemandGroup>>(new Map());
  const [sgNameMap, setSgNameMap] = useState<Map<string, string>>(new Map());

  const hasDemandGroup = demandGroupCode != null && demandGroupCode !== "";
  const hasDemandSubGroup = demandSubGroup != null && demandSubGroup !== "";

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetchDemandGroupsFromSupabase(),
      fetchDemandSubGroupsFromSupabase(),
    ]).then(([dgRows, dsgRows]) => {
      if (cancelled) return;
      if (dgRows) {
        const m = new Map<string, DemandGroup>();
        for (const dg of toDemandGroups(dgRows)) m.set(dg.code, dg);
        setDgMap(m);
      }
      if (dsgRows) setSgNameMap(buildSubGroupNameMap(dsgRows));
    });
    return () => { cancelled = true; };
  }, []);

  if (!hasDemandGroup && !hasDemandSubGroup) return null;

  return (
    <dl className="mt-4 space-y-2 border-t border-aldi-muted-light pt-3">
      {hasDemandGroup && (
        <div>
          <SectionLabel>{labels.demandGroup}</SectionLabel>
          <dd className="mt-0.5 text-sm text-aldi-text">
            {translateDemandGroupName(demandGroupCode!, locale, dgMap)}
          </dd>
        </div>
      )}
      {hasDemandSubGroup && (
        <div>
          <SectionLabel>{labels.demandSubGroup}</SectionLabel>
          <dd className="mt-0.5 text-sm text-aldi-text">
            {sgNameMap.get(demandSubGroup!) ?? formatDemandGroupLabel(demandSubGroup!)}
          </dd>
        </div>
      )}
    </dl>
  );
}
