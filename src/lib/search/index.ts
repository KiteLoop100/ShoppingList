/**
 * Search module: interface and local implementation.
 * Use searchModule() as the single entry point.
 */

import { localSearch } from "./local-search";
import type { SearchModule } from "./types";
import type { SearchResult } from "@/types";

export const searchModule: SearchModule = localSearch;
export type { SearchResult };
export { isLastTripCommand, isAktionsartikelCommand, detectRetailerPrefix, type RetailerPrefixResult } from "./commands";
