# Plan Review Loop Prompt

## Usage
After you receive a plan from the agent, paste the review prompt below.
Repeat it until the agent responds with "REVIEW COMPLETE — no further findings."
Typically this takes 2-3 rounds.

---

## Review Prompt — Copy Below This Line

Review your plan above as a hostile code reviewer who wants to prevent production bugs. Systematically check:

**1. Correctness**
- Does each step actually achieve what it claims?
- Are there logical errors in the sequence of operations?
- Are Zod schemas, TypeScript types, and database columns consistent with each other?

**2. What's Missing**
- Are there error paths without handling?
- Are there user actions the plan doesn't account for? (back button, refresh, double-click, slow network)
- Does the plan handle the "second time" scenario? (user does the action again, data already exists, idempotency)

**3. Integration Risks
- Will this break any existing API consumers?
- Are Supabase RLS policies updated if table access patterns change?
- Does the offline sync layer (Dexie) need updates for new/changed tables?
- Will this cause type errors in files not listed in the plan?

**4. Subtle Bugs**
- Race conditions between optimistic UI and server response
- Stale closures in React hooks
- Missing `await` on async operations
- Null/undefined propagation across function boundaries
- SQL migration running on existing data (UPDATE vs INSERT assumptions)

**Report format:**
For each finding:
- 🔴 **CRITICAL** — would cause a bug or data loss in production
- 🟡 **IMPORTANT** — could cause issues under certain conditions
- 🟢 **SUGGESTION** — improvement, not a bug

If you find ZERO issues across all four categories, respond with exactly:
**"REVIEW COMPLETE — no further findings."**

Otherwise, present your findings AND an updated plan that incorporates the fixes.

---

## When to Stop
- The agent says "REVIEW COMPLETE — no further findings."
- You've done 4+ rounds (diminishing returns — proceed to implementation)
- Only 🟢 suggestions remain and you're comfortable with them

## Pro Tip
If after 2 rounds the agent is still finding 🔴 CRITICAL issues, the feature scope
may be too large. Consider splitting it into smaller, independently deployable chunks.
