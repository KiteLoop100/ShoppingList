-- Lock down the feedback table.
--
-- 20260303200000_feedback.sql created three "admin" policies with USING (true).
-- Those policies are not scoped to any role, so ANY client holding the public
-- anon key (including every anonymous-session visitor) could read, edit and
-- delete ALL users' feedback directly via PostgREST.
--
-- The admin UI does not need them: /api/feedback (GET/PATCH) authenticates via
-- requireAdminAuth() and then uses the service-role client, which bypasses RLS.
--
-- Kept: "Users can insert own feedback" (INSERT, auth.uid()::text = user_id).
-- RLS stays enabled, so with no SELECT/UPDATE/DELETE policy those operations
-- are denied for anon/authenticated roles.
--
-- Idempotent: safe to run more than once.

DROP POLICY IF EXISTS "Admin can select all feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admin can update feedback" ON public.feedback;
DROP POLICY IF EXISTS "Admin can delete feedback" ON public.feedback;
