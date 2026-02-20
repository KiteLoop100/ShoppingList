"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useLocale } from "next-intl";

/**
 * List is merged into main screen (Ein-Screen-Layout).
 * Redirect to main page.
 */
export default function ListRedirectPage() {
  const router = useRouter();
  const locale = useLocale();
  useEffect(() => {
    router.replace(locale === "de" ? "/" : `/${locale}`);
  }, [router, locale]);
  return null;
}
