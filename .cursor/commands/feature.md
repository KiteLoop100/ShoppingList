You receive a change request written by a product manager. Work through these phases in order and stop at each STOP.

Phase 1 – Understand
Restate the request in your own words. List the acceptance criteria. If the request has none, propose 3–5 testable ones. List open questions and assumptions.
STOP: wait for my approval of the criteria.

Phase 2 – Plan
Follow specs/prompts/planning-prompt-template.md. Name affected files, data changes, risks and the tests you will add. Run the review loop from specs/prompts/plan-review-loop.md on your own plan.
STOP: wait for my approval of the plan.

Phase 3 – Implement
Create a branch feature/<short-name> from master. Implement the plan. Add tests for every acceptance criterion. Run: npx tsc --noEmit; npm run lint; npx vitest run; npm run build. Fix failures. Commit. Do not push.

Phase 4 – Report
For each acceptance criterion: how it is met and which test proves it. List what I must test manually on the preview, step by step.
