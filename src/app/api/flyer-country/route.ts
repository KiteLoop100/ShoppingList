/**
 * PATCH: Update a flyer's country (and all its products' country).
 * Used when Claude could not determine the country from the flyer branding.
 */

import { NextResponse } from "next/server";
import { requireAuth, requireSupabaseAdmin } from "@/lib/api/guards";
import { validateBody } from "@/lib/api/validate-request";
import { flyerCountrySchema } from "@/lib/api/schemas";
import { generalRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";
import { log } from "@/lib/utils/logger";

export async function PATCH(request: Request) {
  const validated = await validateBody(request, flyerCountrySchema);
  if (validated instanceof NextResponse) return validated;
  const { flyer_id, country } = validated;

  const identifier = getIdentifier(request);
  const rateLimited = await checkRateLimit(generalRateLimit, identifier);
  if (rateLimited) return rateLimited;

  const auth = await requireAuth(request);
  if (auth instanceof NextResponse) return auth;

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const { error: flyerErr } = await supabase
    .from("flyers")
    .update({ country })
    .eq("flyer_id", flyer_id);

  if (flyerErr) {
    return NextResponse.json({ error: flyerErr.message }, { status: 500 });
  }

  const { error: prodErr } = await supabase
    .from("products")
    .update({ country, updated_at: new Date().toISOString() })
    .eq("flyer_id", flyer_id);

  if (prodErr) {
    log.error("[flyer-country] Products update failed:", prodErr.message);
  }

  return NextResponse.json({ ok: true, flyer_id, country });
}
