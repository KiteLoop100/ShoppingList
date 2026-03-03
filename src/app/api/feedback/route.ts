import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireAuth, requireAdminAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { validateBody } from "@/lib/api/validate-request";
import { feedbackRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { log } from "@/lib/utils/logger";

const feedbackSchema = z.object({
  feedback_type: z.enum(["product", "general", "post_shopping"]),
  product_id: z.string().uuid().nullish(),
  trip_id: z.string().uuid().nullish(),
  store_id: z.string().uuid().nullish(),
  category: z.string().min(1),
  rating: z.number().int().min(1).max(5).nullish(),
  message: z.string().min(10).max(2000),
});

export async function POST(request: Request) {
  const validated = await validateBody(request, feedbackSchema);
  if (validated instanceof NextResponse) return validated;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.user.id;

  const identifier = getIdentifier(request, userId);
  const rateLimited = await checkRateLimit(feedbackRateLimit, identifier);
  if (rateLimited) return rateLimited;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  let dupeQuery = supabase
    .from("feedback")
    .select("feedback_id")
    .eq("user_id", userId)
    .eq("message", validated.message)
    .gte("created_at", cutoff);

  if (validated.product_id && validated.feedback_type === "product") {
    dupeQuery = dupeQuery.eq("product_id", validated.product_id);
  }

  const { data: dupes } = await dupeQuery;

  if (dupes && dupes.length > 0) {
    return NextResponse.json(
      { error: "Duplicate feedback – you already submitted this recently." },
      { status: 409 },
    );
  }

  const { data, error } = await supabase
    .from("feedback")
    .insert({
      user_id: userId,
      feedback_type: validated.feedback_type,
      product_id: validated.product_id ?? null,
      trip_id: validated.trip_id ?? null,
      store_id: validated.store_id ?? null,
      category: validated.category,
      rating: validated.rating ?? null,
      message: validated.message,
    })
    .select("feedback_id")
    .single();

  if (error) {
    log.error("[feedback] Insert failed:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, feedback_id: data.feedback_id });
}

export async function PATCH(request: NextRequest) {
  const adminErr = requireAdminAuth(request);
  if (adminErr) return adminErr;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  let body: { feedback_id?: string; status?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.feedback_id || !body.status) {
    return NextResponse.json({ error: "feedback_id and status required" }, { status: 400 });
  }

  if (!["new", "read", "archived"].includes(body.status)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { error } = await supabase
    .from("feedback")
    .update({ status: body.status })
    .eq("feedback_id", body.feedback_id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(request: NextRequest) {
  const adminErr = requireAdminAuth(request);
  if (adminErr) return adminErr;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const url = new URL(request.url);
  const type = url.searchParams.get("type");
  const category = url.searchParams.get("category");
  const status = url.searchParams.get("status");
  const ratingMin = url.searchParams.get("rating_min");
  const ratingMax = url.searchParams.get("rating_max");
  const dateFrom = url.searchParams.get("date_from");
  const dateTo = url.searchParams.get("date_to");
  const limit = Math.min(Number(url.searchParams.get("limit")) || 50, 200);
  const offset = Number(url.searchParams.get("offset")) || 0;

  let query = supabase
    .from("feedback")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (type) query = query.eq("feedback_type", type);
  if (category) query = query.eq("category", category);
  if (status) query = query.eq("status", status);
  if (ratingMin) query = query.gte("rating", Number(ratingMin));
  if (ratingMax) query = query.lte("rating", Number(ratingMax));
  if (dateFrom) query = query.gte("created_at", dateFrom);
  if (dateTo) query = query.lte("created_at", dateTo);

  const { data, error, count } = await query;

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ feedback: data, total: count });
}
