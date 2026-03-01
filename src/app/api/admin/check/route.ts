import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE_NAME } from "@/lib/api/config";
import { verifyAdminToken } from "@/lib/api/admin-token";

export async function GET(request: NextRequest) {
  const secret = process.env.ADMIN_SESSION_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "ADMIN_SESSION_SECRET not configured" },
      { status: 500 }
    );
  }
  const token = request.cookies.get(ADMIN_COOKIE_NAME)?.value ?? "";
  if (verifyAdminToken(secret, token)) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
