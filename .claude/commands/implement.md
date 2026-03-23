---
argument-hint: [spec-name]
description: Read a spec file, then implement it step by step with commits after each testable step.
---

1. Read the spec file at specs/$ARGUMENTS (try with and without file extensions like .md)
2. Also read CLAUDE.md for project conventions
3. **Reality check:** Before proceeding, verify that the files, folders, services, and patterns referenced in the spec actually exist in the current codebase. If anything is missing, renamed, or different from what the spec describes, STOP and report the discrepancies to me before continuing.
4. Present a brief implementation plan and wait for approval before writing any code
5. Implement step by step. Each step must be independently testable.
6. After each step, run `npx tsc --noEmit` to verify types
7. Commit after each step with a descriptive message: `git add -A && git commit -m "feat: [description]"`
8. If you encounter an architectural decision not covered by the spec, stop and ask
