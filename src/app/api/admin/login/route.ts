import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/api/config";
import { signAdminToken } from "@/lib/api/admin-token";
import { loginRateLimit, checkRateLimit, getIdentifier } from "@/lib/api/rate-limit";

const COOKIE_MAX_AGE = 60 * 60 * 24; // 24 hours

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";

  const identifier = getIdentifier(request);
  const rateLimited = await checkRateLimit(loginRateLimit, identifier);
  if (rateLimited) return rateLimited;

  const sessionSecret = process.env.ADMIN_SESSION_SECRET;
  if (!sessionSecret) {
    return NextResponse.json(
      { error: "ADMIN_SESSION_SECRET not configured" },
      { status: 500 }
    );
  }

  const expected = process.env.ADMIN_PASSWORD ?? "";
  if (!expected || password !== expected) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const token = signAdminToken(sessionSecret, COOKIE_MAX_AGE);
  const res = NextResponse.json({ ok: true });
  res.cookies.set(ADMIN_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: COOKIE_MAX_AGE,
    path: "/",
  });
  return res;
}
