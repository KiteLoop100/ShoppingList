import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { RecipeImportFlow } from "@/components/recipe/RecipeImportFlow";

export default async function RecipeImportPage() {
  const t = await getTranslations("recipeImport");
  const tCommon = await getTranslations("common");

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-aldi-bg md:max-w-2xl">
      <header className="flex shrink-0 items-center gap-3 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <Link
          href="/recipes"
          className="touch-target -ml-2 flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tCommon("back")}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <h1 className="flex-1 text-[17px] font-semibold tracking-tight text-aldi-text">{t("pageTitle")}</h1>
      </header>
      <RecipeImportFlow />
    </main>
  );
}
