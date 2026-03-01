import { NextRequest, NextResponse } from "next/server";
import { requireAdminAuth, requireSupabaseAdmin } from "@/lib/api/guards";

const STALE_THRESHOLD_MS = 10 * 60 * 1000;

export async function GET(request: NextRequest) {
  const authError = requireAdminAuth(request);
  if (authError) return authError;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const { data, error } = await supabase
    .from("batch_jobs")
    .select("job_id, job_type, current_batch, total_processed, total_remaining, updated_at")
    .eq("status", "running")
    .order("started_at", { ascending: false })
    .limit(5);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const now = Date.now();
  const stale = (data ?? []).filter((j) => {
    const updatedAt = new Date(j.updated_at).getTime();
    return now - updatedAt > STALE_THRESHOLD_MS;
  });

  return NextResponse.json(stale);
}
