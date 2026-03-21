"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { createClientIfConfigured } from "@/lib/supabase/client";
import { migrateLocalDataToSupabase } from "@/lib/auth/auth-helpers";
import { looksLikeRegisteredAccountUser } from "@/lib/auth/session-guards";
import { resetActiveListCache } from "@/lib/list/active-list";
import type { User, Session } from "@supabase/supabase-js";
import { log } from "@/lib/utils/logger";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAnonymous: boolean;
  signUp: (email: string, password: string) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  linkEmail: (email: string, password: string) => Promise<{ error: string | null }>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let cachedUserId: string | null = null;

export function getCurrentUserId(): string {
  if (cachedUserId) return cachedUserId;
  if (typeof window === "undefined") return "anonymous";
  return cachedUserId ?? "anonymous";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current) return;
    initRef.current = true;

    const supabase = createClientIfConfigured();
    if (!supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(async ({ data: { session: existing } }) => {
      if (existing?.user) {
        setSession(existing);
        setUser(existing.user);
        cachedUserId = existing.user.id;
        migrateLocalDataToSupabase(existing.user.id).catch(() => {});
        setLoading(false);
      } else {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (data?.session?.user) {
          setSession(data.session);
          setUser(data.session.user);
          cachedUserId = data.session.user.id;
          migrateLocalDataToSupabase(data.session.user.id).catch(() => {});
        }
        if (error) {
          log.error("[Auth] Anonymous sign-in failed:", error.message);
        }
        setLoading(false);
      }
    }).catch((err) => {
      log.error("[Auth] getSession failed:", err);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);
        cachedUserId = newSession?.user?.id ?? null;
      }
    );

    const syncSessionFromClient = () => {
      supabase.auth.getSession().then(({ data: { session: s } }) => {
        setSession(s);
        setUser(s?.user ?? null);
        cachedUserId = s?.user?.id ?? null;
      }).catch((err) => {
        log.error("[Auth] getSession (sync) failed:", err);
      });
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) syncSessionFromClient();
    };
    window.addEventListener("pageshow", onPageShow);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.signUp({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = createClientIfConfigured();
    if (!supabase) return;
    resetActiveListCache();
    try {
      await supabase.auth.signOut();
    } catch (e) {
      log.error("[Auth] signOut failed:", e);
    }
    const { data: { session: afterSignOut } } = await supabase.auth.getSession();
    if (!afterSignOut) {
      setSession(null);
      setUser(null);
      cachedUserId = null;
      const { data, error } = await supabase.auth.signInAnonymously();
      if (data?.session?.user) {
        setSession(data.session);
        setUser(data.session.user);
        cachedUserId = data.session.user.id;
      }
      if (error) {
        log.error("[Auth] Anonymous sign-in after signOut failed:", error.message);
      }
      return;
    }
    const u = afterSignOut.user;
    if (!looksLikeRegisteredAccountUser(u)) {
      setSession(afterSignOut);
      setUser(u);
      cachedUserId = u.id;
      return;
    }
    log.warn("[Auth] Registered session still present after signOut; clearing client state");
    setSession(null);
    setUser(null);
    cachedUserId = null;
    try {
      await supabase.auth.signOut();
    } catch (e) {
      log.error("[Auth] second signOut failed:", e);
    }
    const { data: anon } = await supabase.auth.signInAnonymously();
    if (anon.session?.user) {
      setSession(anon.session);
      setUser(anon.session.user);
      cachedUserId = anon.session.user.id;
    }
  }, []);

  const linkEmail = useCallback(async (email: string, password: string) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return { error: "Supabase not configured" };

    const { error } = await supabase.auth.updateUser({
      email,
      password,
    });
    return { error: error?.message ?? null };
  }, []);

  const resetPassword = useCallback(async (email: string) => {
    const supabase = createClientIfConfigured();
    if (!supabase) return { error: "Supabase not configured" };
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    return { error: error?.message ?? null };
  }, []);

  const isAnonymous = user?.is_anonymous === true;

  const value = useMemo(() => ({
    user, session, loading, isAnonymous,
    signUp, signIn, signOut, linkEmail, resetPassword,
  }), [user, session, loading, isAnonymous, signUp, signIn, signOut, linkEmail, resetPassword]);

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
