"use client";

import { type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { useBreakpoint } from "@/hooks/use-breakpoint";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const bp = useBreakpoint();
  const tCommon = useTranslations("common");
  const tCatalog = useTranslations("catalog");
  const tFlyer = useTranslations("flyer");
  const tReceipts = useTranslations("receipts");
  const pathname = usePathname();

  if (bp !== "desktop") return <>{children}</>;

  const navItems = [
    { href: "/" as const, label: tCommon("appName"), match: (p: string) => p === "/" || p === "" },
    { href: "/catalog" as const, label: tCatalog("navLabel"), match: (p: string) => p.startsWith("/catalog") },
    { href: "/flyer" as const, label: tFlyer("navLabel"), match: (p: string) => p.startsWith("/flyer") },
    { href: "/receipts" as const, label: tReceipts("navLabel"), match: (p: string) => p.startsWith("/receipts") },
    { href: "/settings" as const, label: tCommon("settings"), match: (p: string) => p.startsWith("/settings") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="sticky top-0 z-30 flex items-center gap-1 border-b border-aldi-muted-light bg-white px-8 py-2 shadow-sm">
        <span className="mr-4 text-lg font-bold text-aldi-blue">{tCommon("appName")}</span>
        {navItems.map((item) => {
          const active = item.match(pathname);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-aldi-blue/10 text-aldi-blue"
                  : "text-aldi-text hover:bg-aldi-muted-light/50 hover:text-aldi-blue"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
