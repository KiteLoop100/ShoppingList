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
import { getDefaultStoreId } from "@/lib/settings/default-store";
import { getCountryFromDevice } from "@/lib/geo/country-from-device";
import { checkGpsAllowed } from "@/lib/geo/gps-permission";

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
  // Initialize to "DE" so ProductsProvider can start fetching immediately
  // without waiting for async country resolution.
  const [country, setCountryState] = useState<CountryCode | null>("DE");
  const loading = false;

  const setCountry = useCallback((c: CountryCode) => {
    setCountryState(c);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // 1. Active list's store takes priority
        const list = await getOrCreateActiveList();
        if (cancelled) return;
        if (list.store_id) {
          const store = await getStoreById(list.store_id);
          if (cancelled) return;
          if (store?.country) {
            setCountryState(store.country.toUpperCase());
            return;
          }
        }
        // 2. Default store from settings
        const defaultStoreId = getDefaultStoreId();
        if (defaultStoreId) {
          const store = await getStoreById(defaultStoreId);
          if (cancelled) return;
          if (store?.country) {
            setCountryState(store.country.toUpperCase());
            return;
          }
        }
        // 3. GPS / device location (only if GPS is enabled)
        const gpsCheck = await checkGpsAllowed();
        if (cancelled) return;
        if (gpsCheck.allowed) {
          const fromDevice = await getCountryFromDevice();
          if (cancelled) return;
          setCountryState(fromDevice);
        }
      } catch {
        // Already initialized to "DE", nothing to do
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
