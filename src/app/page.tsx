import { redirect } from "next/navigation";
import { routing } from "@/lib/i18n/routing";

/**
 * Root path "/" has no [locale] segment. Redirect to default locale
 * so the app always runs under a valid locale route and next-intl works.
 */
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
