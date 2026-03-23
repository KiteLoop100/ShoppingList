import { getTranslations } from "next-intl/server";
import { Link } from "@/lib/i18n/navigation";
import { SavedRecipesList } from "@/components/recipe/SavedRecipesList";

export default async function RecipesHubPage() {
  const t = await getTranslations("recipes");
  const tCommon = await getTranslations("common");

  return (
    <main className="mx-auto flex min-h-screen max-w-lg flex-col bg-aldi-bg md:max-w-2xl">
      <header className="flex shrink-0 items-center gap-3 bg-white px-5 py-4 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
        <Link
          href="/"
          className="touch-target -ml-2 flex items-center justify-center rounded-xl text-aldi-blue transition-colors hover:bg-aldi-blue-light"
          aria-label={tCommon("back")}
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
          </svg>
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="text-[17px] font-semibold tracking-tight text-aldi-text">{t("recipes")}</h1>
          <p className="text-xs text-gray-500">{t("hubSubtitle")}</p>
        </div>
      </header>

      <div className="flex flex-col gap-3 px-4 py-6 md:px-6">
        <Link
          href="/recipe-import"
          className="touch-target flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors pointer-fine:hover:border-aldi-blue/40 pointer-fine:hover:bg-aldi-blue/5"
        >
          <span className="text-sm font-semibold text-aldi-text">{t("recipeImport")}</span>
          <span className="text-aldi-blue" aria-hidden>
            →
          </span>
        </Link>
        <Link
          href="/cook"
          className="touch-target flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3 shadow-sm transition-colors pointer-fine:hover:border-aldi-blue/40 pointer-fine:hover:bg-aldi-blue/5"
        >
          <span className="text-sm font-semibold text-aldi-text">{t("whatCanICook")}</span>
          <span className="text-aldi-blue" aria-hidden>
            →
          </span>
        </Link>
        <div id="my-recipes" className="flex flex-col gap-2">
          <SavedRecipesList />
        </div>
      </div>
    </main>
  );
}
