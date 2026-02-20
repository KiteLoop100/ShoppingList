import { NextRequest, NextResponse } from "next/server";

const ADMIN_COOKIE = "admin_session";

export async function GET(request: NextRequest) {
  const session = request.cookies.get(ADMIN_COOKIE)?.value;
  if (session === "1") {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.json({ ok: false }, { status: 401 });
}
