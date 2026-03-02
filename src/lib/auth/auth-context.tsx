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

    return () => {
      subscription.unsubscribe();
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
    await supabase.auth.signOut();
    cachedUserId = null;
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
