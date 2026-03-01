"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";

interface AdminAuthGuardProps {
  children: React.ReactNode;
}

export function AdminAuthGuard({ children }: AdminAuthGuardProps) {
  const t = useTranslations("admin");
  const tCommon = useTranslations("common");
  const [auth, setAuth] = useState<boolean | null>(null);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState(false);

  const checkAuth = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/check");
      setAuth(res.ok);
    } catch {
      setAuth(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError(false);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) {
      setAuth(true);
      setPassword("");
    } else {
      setLoginError(true);
    }
  };

  if (auth === null) {
    return (
      <main className="mx-auto min-h-screen max-w-2xl bg-aldi-bg p-4">
        <p className="text-aldi-muted">{tCommon("loading")}</p>
      </main>
    );
  }

  if (auth === false) {
    return (
      <main className="mx-auto min-h-screen max-w-md bg-aldi-bg p-4">
        <h1 className="mb-6 text-xl font-bold text-aldi-blue">{t("title")}</h1>
        <form onSubmit={handleLogin} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-aldi-muted">{t("password")}</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light px-4 py-3 focus:border-aldi-blue focus:outline-none"
              autoComplete="current-password"
            />
          </label>
          {loginError && <p className="text-sm font-medium text-aldi-error">{t("loginError")}</p>}
          <button type="submit" className="min-h-touch w-full rounded-xl bg-aldi-blue px-4 py-3 font-semibold text-white transition-colors hover:bg-aldi-blue/90">
            {t("login")}
          </button>
        </form>
      </main>
    );
  }

  return <>{children}</>;
}
