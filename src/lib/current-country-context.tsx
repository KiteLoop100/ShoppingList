"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";
import { getOrCreateActiveList } from "@/lib/list/active-list";
import { getStoreById } from "@/lib/store/store-service";
import { getCountryFromDevice } from "@/lib/geo/country-from-device";

type CountryCode = string; // e.g. "AT" | "DE"

interface CurrentCountryContextValue {
  /** Resolved country for product filtering. Null while loading. */
  country: CountryCode | null;
  loading: boolean;
  /** Call when user selects a store (so products reload for that store's country). */
  setCountry: (country: CountryCode) => void;
}

const CurrentCountryContext = createContext<CurrentCountryContextValue | null>(null);

export function CurrentCountryProvider({ children }: { children: ReactNode }) {
  const [country, setCountryState] = useState<CountryCode | null>(null);
  const [loading, setLoading] = useState(true);

  const setCountry = useCallback((c: CountryCode) => {
    setCountryState(c);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await getOrCreateActiveList();
        if (cancelled) return;
        if (list.store_id) {
          const store = await getStoreById(list.store_id);
          if (cancelled) return;
          if (store?.country) {
            setCountryState(store.country.toUpperCase());
            setLoading(false);
            return;
          }
        }
        const fromDevice = await getCountryFromDevice();
        if (cancelled) return;
        setCountryState(fromDevice);
      } catch {
        if (!cancelled) setCountryState("DE");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<CurrentCountryContextValue>(
    () => ({ country, loading, setCountry }),
    [country, loading, setCountry]
  );

  return (
    <CurrentCountryContext.Provider value={value}>
      {children}
    </CurrentCountryContext.Provider>
  );
}

export function useCurrentCountry(): CurrentCountryContextValue {
  const ctx = useContext(CurrentCountryContext);
  if (!ctx) {
    return {
      country: "DE",
      loading: false,
      setCountry: () => {},
    };
  }
  return ctx;
}
