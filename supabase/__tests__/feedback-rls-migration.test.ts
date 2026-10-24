import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const migrationsDir = join(process.cwd(), "supabase", "migrations");
const SQL = readFileSync(
  join(migrationsDir, "20261024150000_lock_down_feedback_rls.sql"),
  "utf8",
);
/** Statements only, without SQL comments. */
const STATEMENTS = SQL.split("\n")
  .filter((l) => !l.trim().startsWith("--"))
  .join("\n");

describe("20261024150000_lock_down_feedback_rls.sql", () => {
  it.each(["Admin can select all feedback", "Admin can update feedback", "Admin can delete feedback"])(
    "drops the open policy %s",
    (name) => {
      expect(STATEMENTS).toContain(`DROP POLICY IF EXISTS "${name}" ON public.feedback;`);
    },
  );

  it("drops exactly the three USING (true) policies from the feedback migration", () => {
    const original = readFileSync(
      join(migrationsDir, "20260303200000_feedback.sql"),
      "utf8",
    );
    const open = [...original.matchAll(/CREATE POLICY "([^"]+)"[\s\S]*?;/g)]
      .filter((m) => /USING\s*\(\s*true\s*\)/i.test(m[0]))
      .map((m) => m[1])
      .sort();
    const dropped = [...STATEMENTS.matchAll(/DROP POLICY IF EXISTS "([^"]+)"/g)]
      .map((m) => m[1])
      .sort();
    expect(open.length).toBe(3);
    expect(dropped).toEqual(open);
  });

  it("keeps the insert-own policy and RLS enabled", () => {
    expect(STATEMENTS).not.toContain("Users can insert own feedback");
    expect(STATEMENTS).not.toMatch(/DISABLE ROW LEVEL SECURITY/i);
  });

  it("does not destroy data", () => {
    expect(STATEMENTS).not.toMatch(/DROP TABLE|DELETE FROM|TRUNCATE/i);
  });
});
