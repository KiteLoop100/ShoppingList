# Search module

Local fuzzy search over IndexedDB product data. Fully implemented.

Architecture: `query-preprocessor` normalizes input and detects commands/retailer prefixes,
`candidate-retrieval` loads candidates from IndexedDB, `scoring-engine` ranks them using
multi-signal scoring (prefix, substring, word-boundary, synonym), and `post-processor`
deduplicates and caps results. `search-indexer` maintains a pre-built trigram index for
fast candidate lookup. See `types.ts` for interfaces and `constants.ts` for tuning parameters.
