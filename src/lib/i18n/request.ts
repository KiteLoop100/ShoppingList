import { getRequestConfig } from "next-intl/server";
import type { AbstractIntlMessages } from "next-intl";
import { routing } from "./routing";
import { log } from "@/lib/utils/logger";

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as "de" | "en")) {
    locale = routing.defaultLocale;
  }
  let messages: AbstractIntlMessages;
  try {
    messages = (await import(`@/messages/${locale}.json`)).default;
  } catch (e) {
    log.error("[next-intl] Failed to load messages for locale:", locale, e);
    messages = {};
  }
  return {
    locale,
    messages,
    timeZone: "Europe/Berlin",
  };
});
