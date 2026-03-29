"use client";

import { type ReactNode, useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Link, usePathname } from "@/lib/i18n/navigation";
import { useBreakpoint } from "@/hooks/use-breakpoint";
import { loadSettings } from "@/lib/settings/settings-sync";
import { Tooltip } from "@/components/common/tooltip";

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const bp = useBreakpoint();
  const tCommon = useTranslations("common");
  const tCatalog = useTranslations("catalog");
  const tFlyer = useTranslations("flyer");
  const tReceipts = useTranslations("receipts");
  const tRecipes = useTranslations("recipes");
  const tInsights = useTranslations("insights");
  const pathname = usePathname();
  const [invEnabled, setInvEnabled] = useState(false);

  useEffect(() => {
    loadSettings().then((s) => setInvEnabled(s.enable_inventory));
  }, []);

  if (bp !== "desktop") return <>{children}</>;

  const navItems = [
    { href: "/" as const, label: tCommon("appName"), match: (p: string) => p === "/" || p === "" },
    { href: "/catalog" as const, label: tCatalog("navLabel"), match: (p: string) => p.startsWith("/catalog") },
    {
      href: "/recipes" as const,
      label: tRecipes("navLabel"),
      match: (p: string) =>
        p.startsWith("/recipes") || p.startsWith("/recipe-import") || p.startsWith("/cook"),
    },
    { href: "/flyer" as const, label: tFlyer("navLabel"), match: (p: string) => p.startsWith("/flyer") },
    { href: "/receipts" as const, label: invEnabled ? tReceipts("householdTitle") : tReceipts("navLabel"), match: (p: string) => p.startsWith("/receipts") },
    { href: "/insights" as const, label: tInsights("navLabel"), match: (p: string) => p.startsWith("/insights") },
    { href: "/settings" as const, label: tCommon("settings"), match: (p: string) => p.startsWith("/settings") },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <nav className="sticky top-0 z-30 flex items-center gap-1 border-b border-aldi-muted-light bg-white px-8 py-2 shadow-sm">
        <span className="mr-4 text-lg font-bold text-aldi-blue">{tCommon("appName")}</span>
        {navItems.map((item) => {
          const active = item.match(pathname);
          return (
            <Tooltip key={item.href} content={item.label} position="bottom">
              <Link
                href={item.href}
                className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-aldi-blue/10 text-aldi-blue"
                    : "text-aldi-text pointer-fine:hover:bg-aldi-muted-light/50 pointer-fine:hover:text-aldi-blue"
                }`}
              >
                {item.label}
              </Link>
            </Tooltip>
          );
        })}
      </nav>
      <div className="flex-1">{children}</div>
    </div>
  );
}
