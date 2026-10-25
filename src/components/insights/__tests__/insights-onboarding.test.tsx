import { describe, expect, test, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import de from "@/messages/de.json";
import en from "@/messages/en.json";
import { InsightsOnboarding } from "@/components/insights/insights-onboarding";

vi.mock("@/lib/i18n/navigation", () => ({
  Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
    <a href={href} className={className}>{children}</a>
  ),
}));

function render(locale: "de" | "en", latestReceiptDate: string | null): string {
  const messages = locale === "de" ? de : en;
  return renderToStaticMarkup(
    <NextIntlClientProvider locale={locale} messages={messages}>
      <InsightsOnboarding latestReceiptDate={latestReceiptDate} />
    </NextIntlClientProvider>,
  );
}

describe("InsightsOnboarding", () => {
  test("no receipts: shows the 90-day message, no date line, keeps the scan button (DE)", () => {
    const html = render("de", null);
    expect(html).toContain("Für Insights brauchst du mindestens 3 gescannte Kassenbons aus den letzten 3 Monaten.");
    expect(html).not.toContain("Dein letzter Bon");
    expect(html).toContain('href="/capture"');
    expect(html).toContain("Kassenzettel scannen");
  });

  test("older receipts only: shows the date line (DE)", () => {
    const html = render("de", "2026-07-13");
    expect(html).toContain("Für Insights brauchst du mindestens 3 gescannte Kassenbons aus den letzten 3 Monaten.");
    expect(html).toContain("Dein letzter Bon ist vom 13.07.2026.");
    expect(html).toContain('href="/capture"');
  });

  test("English equivalent, with and without date line", () => {
    const withDate = render("en", "2026-07-13");
    expect(withDate).toContain("For Insights you need at least 3 scanned receipts from the last 3 months.");
    expect(withDate).toContain("Your last receipt is from 07/13/2026.");
    expect(withDate).toContain("Scan receipt");

    const without = render("en", null);
    expect(without).not.toContain("Your last receipt");
  });

  test("malformed date omits the date line instead of showing garbage", () => {
    expect(render("de", "garbage")).not.toContain("Dein letzter Bon");
  });
});
