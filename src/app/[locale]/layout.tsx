import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/lib/i18n/routing";
import { CurrentCountryProvider } from "@/lib/current-country-context";
import { ProductsProvider } from "@/lib/products-context";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  const { locale } = params;
  if (!routing.locales.includes(locale as "de" | "en")) {
    notFound();
  }
  const messages = await getMessages();
  return (
    <NextIntlClientProvider messages={messages}>
      <CurrentCountryProvider>
        <ProductsProvider>
          {children}
        </ProductsProvider>
      </CurrentCountryProvider>
    </NextIntlClientProvider>
  );
}
