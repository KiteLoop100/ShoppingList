import { redirect } from "next/navigation";

/**
 * List is merged into main screen (Ein-Screen-Layout).
 * Redirect to main page.
 */
export default function ListRedirectPage({
  params,
}: {
  params: { locale: string };
}) {
  const locale = params.locale;
  redirect(locale === "de" ? "/" : `/${locale}`);
}
