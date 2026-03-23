---
argument-hint: [file-or-folder-path]
description: Audit code against project architecture and conventions.
---

1. Read CLAUDE.md and specs/ARCHITECTURE.md
2. Read the file or folder at $ARGUMENTS
3. **Reality check:** If CLAUDE.md or ARCHITECTURE.md reference patterns, services, files, or folder structures that don't match what you actually find in the codebase, report these discrepancies as the first item in your audit — the documentation itself may be outdated.
4. Check for these issues:
   - Business logic in React components that should be in service layers
   - Direct Supabase calls from UI code (should go through services)
   - Missing TypeScript types or use of `any`
   - Settings changes that don't call saveSettings()
   - Patterns that violate the conventions in CLAUDE.md
5. Report findings as a numbered list with file paths and line numbers
6. For each issue, suggest the specific fix
7. Do NOT make any changes — this is a read-only audit
