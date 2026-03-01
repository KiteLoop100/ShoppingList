/**
 * Shared guard helpers for API routes.
 * Each returns a NextResponse on failure so routes can `return` it immediately.
 */

import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerFromRequest } from "@/lib/supabase/server";
import { verifyAdminToken } from "./admin-token";
import { ADMIN_COOKIE_NAME } from "./config";

export function requireApiKey(): string | NextResponse {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY not configured" },
      { status: 500 }
    );
  }
  return key;
}

export function requireAdminAuth(request: NextRequest): NextResponse | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "ADMIN_SESSION_SECRET not configured" },
      { status: 500 }
    );
  }
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? "";
  if (!verifyAdminToken(secret, token)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

export function requireSupabaseAdmin(): SupabaseClient | NextResponse {
  const client = createAdminClient();
  if (!client) {
    return NextResponse.json(
      { error: "Supabase not configured" },
      { status: 500 }
    );
  }
  return client;
}

/**
 * Verify that the request carries a valid Supabase auth session
 * (anonymous or registered). Returns the authenticated User on success,
 * or a 401/500 NextResponse on failure.
 */
export async function requireAuth(
  request: Request
): Promise<{ user: User } | NextResponse> {
  const supabase = createSupabaseServerFromRequest(request);
  if (!supabase) {
    return NextResponse.json(
      { error: "Auth not configured" },
      { status: 500 }
    );
  }
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return { user };
}
