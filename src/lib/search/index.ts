/**
 * Search module: interface and local implementation.
 * Use searchModule() as the single entry point.
 */

import { localSearch } from "./local-search";
import type { SearchModule, SearchModuleInput } from "./types";
import type { SearchResult } from "@/types";

export const searchModule: SearchModule = localSearch;
export type { SearchModuleInput, SearchResult };
export { normalizeForSearch, fuzzyMatches } from "./normalize";
export { isLastTripCommand } from "./commands";
