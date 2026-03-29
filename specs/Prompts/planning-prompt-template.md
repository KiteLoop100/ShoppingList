# Planning Prompt Template

## Usage
Copy the section below (between the --- markers) and paste it into Cursor's Plan Mode.
Replace the `[PLACEHOLDERS]` with your specifics.

---

## Planning Prompt — Copy Below This Line

I need a thorough implementation plan for:

**Feature/Task:** [Brief description of what you want to build or change]

**Spec file (if exists):** [e.g., @specs/F-RECIPE-SUGGESTIONS-SPEC.md — attach with @]

**Context files to read first:**
[List relevant files the agent should examine before planning, e.g.:]
- @src/lib/[domain]/[relevant-module].ts
- @src/app/api/[relevant-route]/route.ts
- @supabase/migrations/ (latest relevant migration)

**Acceptance criteria:**
1. [What must be true when this is done?]
2. [What behavior should the user see?]
3. [What should NOT change?]

**Constraints:**
- Must not break: [list critical existing features]
- Must work with: [existing patterns, e.g., "offline sync", "existing RLS policies"]
- Budget: [e.g., "max 5 new files", "no new dependencies", "single migration"]

**Follow the planning-quality rule. I expect:**
- A blast radius analysis before proposing solutions
- The full edge cases checklist with answers for each item
- A regression risk assessment naming specific features
- A test plan
- A confidence declaration

Take your time. I prefer a thorough plan over a fast one.

---
