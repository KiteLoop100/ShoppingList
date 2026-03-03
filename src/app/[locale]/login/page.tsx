"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter, Link } from "@/lib/i18n/navigation";
import { useAuth } from "@/lib/auth/auth-context";

type Mode = "login" | "register";

export default function LoginPage() {
  const t = useTranslations("auth");
  const router = useRouter();
  const { signIn, signUp, loading: authLoading } = useAuth();

  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const { resetPassword } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    const result =
      mode === "login"
        ? await signIn(email, password)
        : await signUp(email, password);

    setSubmitting(false);

    if (result.error) {
      setError(result.error);
    } else {
      router.push("/");
    }
  };

  const handleContinueAnonymously = () => {
    router.push("/");
  };

  const handleResetPassword = async () => {
    if (!email) {
      setError(t("enterEmailFirst"));
      return;
    }
    setError(null);
    const result = await resetPassword(email);
    if (result.error) {
      setError(result.error);
    } else {
      setResetSent(true);
    }
  };

  if (authLoading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-aldi-bg">
        <div className="h-8 w-8 animate-spin rounded-full border-3 border-aldi-muted-light border-t-aldi-blue" />
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-aldi-bg px-4">
      <div className="w-full max-w-sm">
        <div className="mb-10 text-center">
          <div className="mb-3 text-4xl">🛒</div>
          <h1 className="text-xl font-bold text-aldi-blue">{t("appTitle")}</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t("email")}
              required
              autoComplete="email"
              className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:border-aldi-blue focus:outline-none"
            />
          </div>
          <div>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={t("password")}
              required
              minLength={6}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] text-aldi-text placeholder:text-aldi-muted focus:border-aldi-blue focus:outline-none"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-aldi-error">
              {error}
            </p>
          )}

          {resetSent && (
            <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-aldi-success">
              {t("resetEmailSent")}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="min-h-touch w-full rounded-xl bg-aldi-blue px-4 py-3 text-[15px] font-semibold text-white transition-colors hover:bg-aldi-blue/90 disabled:opacity-60"
          >
            {submitting
              ? "…"
              : mode === "login"
                ? t("signIn")
                : t("createAccount")}
          </button>

          <button
            type="button"
            onClick={() => {
              setMode(mode === "login" ? "register" : "login");
              setError(null);
            }}
            className="min-h-touch w-full rounded-xl border-2 border-aldi-blue bg-white px-4 py-3 text-[15px] font-semibold text-aldi-blue transition-colors hover:bg-aldi-blue/5"
          >
            {mode === "login" ? t("createAccount") : t("signIn")}
          </button>
        </form>

        <div className="my-6 flex items-center gap-3">
          <hr className="flex-1 border-aldi-muted-light" />
          <span className="text-xs text-aldi-muted">{t("or")}</span>
          <hr className="flex-1 border-aldi-muted-light" />
        </div>

        <button
          type="button"
          onClick={handleContinueAnonymously}
          className="min-h-touch w-full rounded-xl border-2 border-aldi-muted-light bg-white px-4 py-3 text-[15px] font-medium text-aldi-text transition-colors hover:border-aldi-blue/30 hover:bg-aldi-muted-light/30"
        >
          {t("continueWithout")}
        </button>

        <div className="mt-4 text-center">
          <button
            type="button"
            onClick={handleResetPassword}
            className="text-sm text-aldi-muted underline-offset-2 hover:text-aldi-blue hover:underline"
          >
            {t("forgotPassword")}
          </button>
        </div>

        <p className="mt-6 text-center text-xs text-aldi-muted">
          {t.rich("privacyNotice", {
            privacyLink: (chunks) => (
              <Link
                href="/privacy"
                className="text-aldi-blue underline underline-offset-2 hover:text-aldi-blue/80"
              >
                {chunks}
              </Link>
            ),
          })}
        </p>
      </div>
    </main>
  );
}
