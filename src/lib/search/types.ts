/**
 * Search module interface (ARCHITECTURE.md 4.1).
 * Input: query, user_id?, limit
 * Output: SearchResult[]
 */

import type { Product, SearchResult } from "@/types";

export interface SearchModuleInput {
  query: string;
  user_id?: string;
  limit?: number;
  /** When set, search uses this list instead of IndexedDB (e.g. Supabase products loaded on app start). */
  products?: Product[];
}

export type SearchModule = (
  input: SearchModuleInput
) => Promise<SearchResult[]>;

export type { SearchResult };
