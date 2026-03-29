# Implementation Prompt

Use this after a plan has passed the review loop ("REVIEW COMPLETE").
Two variants: one for continuing in the same session, one for a fresh session.

---

## Variant A: Same session (plan is in conversation history)

```
Switch from Plan Mode to Act Mode.

Implement the reviewed plan step by step. Rules:

1. Execute ONE step at a time. After each step, pause and confirm:
   - What you changed (files touched)
   - That it compiles without errors (run type-check)
   - That the risk noted for this step has been addressed

2. Do NOT skip ahead, combine steps, or "optimize" the plan by doing things differently than planned. The plan was reviewed for a reason — deviations reintroduce the bugs we already caught.

3. If you encounter something unexpected during implementation (a file that looks different than expected, a type that doesn't match, a dependency issue):
   - STOP and report it
   - Do NOT silently work around it
   - Let me decide whether to adjust the plan or investigate

4. After all steps are done, run the existing test suite and report results.

Start with Step 1.
```

---

## Variant B: New session (paste or reference the plan)

```
Implement the following reviewed plan step by step.

Plan: @specs/plans/[PLAN-FILE].md
Spec: @specs/[SPEC-FILE].md
Related code: @src/lib/[RELEVANT-DIR] @src/components/[RELEVANT-DIR]

Rules:

1. Execute ONE step at a time. After each step, pause and confirm:
   - What you changed (files touched)
   - That it compiles without errors (run type-check)
   - That the risk noted for this step has been addressed

2. Do NOT deviate from the plan. The plan was reviewed and revised specifically to avoid bugs. If you think the plan is wrong or suboptimal, STOP and tell me — do not silently "improve" it.

3. If you encounter something unexpected:
   - STOP and report it
   - Do NOT silently work around it
   - Let me decide how to proceed

4. After all steps are done, run the existing test suite and report results.

Start with Step 1.
```

---

## Tips

### Save your reviewed plan as a file
After the plan passes review, ask the agent:
```
Save the final reviewed plan as specs/plans/[FEATURE-NAME]-plan.md
```
This gives you a reference artifact you can @ in a fresh session, share with others, or compare against what was actually implemented.

### Step-by-step vs. full auto
The "one step at a time" approach is slower but catches problems early. If you trust the plan and the feature is small (3-5 steps), you can say:
```
Implement steps 1-3, then pause for my review before continuing.
```
For larger features (8+ steps), always go one at a time.

### Handling agent "improvements"
Agents love to "improve" things they weren't asked to touch. The explicit "do NOT deviate" instruction fights this. If the agent says "I also noticed X and fixed it" — that's a red flag. Undo it and evaluate separately.

### When things go wrong mid-implementation
If Step 4 of 8 reveals a problem:
1. Don't let the agent freestyle a fix
2. Go back to Plan Mode
3. Re-plan from Step 4 onward with the new information
4. Run a mini review loop on the revised steps
5. Then continue implementation
