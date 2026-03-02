"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-bold text-aldi-blue">{title}</h2>
      {children}
    </section>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-2 pl-1">
      {items.map((item, i) => (
        <li key={i} className="flex gap-2 text-[15px] leading-relaxed text-aldi-text">
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-aldi-blue" />
          <span>{item}</span>
        </li>
      ))}
    </ul>
  );
}

export function PrivacyClient() {
  const t = useTranslations("privacy");
  const tCommon = useTranslations("common");

  return (
    <main className="mx-auto min-h-screen max-w-lg bg-aldi-bg p-4 pb-12 md:max-w-2xl md:p-6 lg:p-8">
      <header className="sticky top-0 z-10 -mx-4 flex items-center gap-3 bg-aldi-bg px-4 py-3 md:-mx-6 md:px-6 lg:-mx-8 lg:px-8">
        <Link
          href="/settings"
          className="touch-target flex items-center justify-center rounded-lg font-medium text-aldi-blue transition-colors hover:bg-aldi-muted-light/50"
          aria-label={tCommon("back")}
        >
          ←
        </Link>
        <h1 className="text-xl font-bold text-aldi-blue">{t("title")}</h1>
      </header>

      <p className="mb-6 text-sm text-aldi-muted">{t("lastUpdated")}</p>

      <div className="space-y-8">
        <Section title={t("responsibleTitle")}>
          <p className="rounded-xl border-2 border-dashed border-aldi-muted-light bg-white px-4 py-3 text-[15px] italic text-aldi-muted">
            {t("responsibleText")}
          </p>
        </Section>

        <Section title={t("dataCollectionTitle")}>
          <p className="text-[15px] text-aldi-text">{t("dataCollectionIntro")}</p>
          <BulletList
            items={[
              t("dataEmail"),
              t("dataShoppingData"),
              t("dataReceiptPhotos"),
              t("dataGps"),
              t("dataDevice"),
            ]}
          />
        </Section>

        <Section title={t("purposeTitle")}>
          <p className="text-[15px] text-aldi-text">{t("purposeIntro")}</p>
          <BulletList
            items={[
              t("purposeAuth"),
              t("purposeList"),
              t("purposeReceipt"),
              t("purposeStore"),
              t("purposeImprovement"),
            ]}
          />
        </Section>

        <Section title={t("storageTitle")}>
          <p className="text-[15px] text-aldi-text">{t("storageIntro")}</p>
          <BulletList
            items={[
              t("storageSupabase"),
              t("storageVercel"),
              t("storageSentry"),
            ]}
          />
          <p className="text-[15px] text-aldi-text">{t("storageLocal")}</p>
        </Section>

        <Section title={t("thirdPartyTitle")}>
          <p className="text-[15px] text-aldi-text">{t("thirdPartyIntro")}</p>
          <BulletList
            items={[
              t("thirdPartyClaude"),
              t("thirdPartyGemini"),
            ]}
          />
          <p className="text-sm text-aldi-muted">{t("thirdPartyNote")}</p>
        </Section>

        <Section title={t("rightsTitle")}>
          <p className="text-[15px] text-aldi-text">{t("rightsIntro")}</p>
          <BulletList
            items={[
              t("rightsAccess"),
              t("rightsRectification"),
              t("rightsDeletion"),
              t("rightsPortability"),
              t("rightsComplaint"),
            ]}
          />
        </Section>

        <Section title={t("deletionTitle")}>
          <p className="text-[15px] leading-relaxed text-aldi-text">
            {t("deletionText")}
          </p>
        </Section>

        <Section title={t("cookiesTitle")}>
          <p className="text-[15px] leading-relaxed text-aldi-text">
            {t("cookiesText")}
          </p>
        </Section>

        <Section title={t("contactTitle")}>
          <p className="text-[15px] text-aldi-text">{t("contactText")}</p>
          <p className="rounded-xl border-2 border-dashed border-aldi-muted-light bg-white px-4 py-3 text-[15px] italic text-aldi-muted">
            {t("contactEmail")}
          </p>
        </Section>
      </div>
    </main>
  );
}
