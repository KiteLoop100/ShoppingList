import { NextRequest, NextResponse } from "next/server";

/**
 * Web Share Target handler: redirects into the localized recipe-import page with `?url=`.
 * @see specs/F-RECIPE-FEATURES-SPEC.md — Section 2.6 (b)
 */
export function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  let rawUrl = searchParams.get("url")?.trim() ?? "";

  if (!rawUrl) {
    const text = searchParams.get("text")?.trim() ?? "";
    const fromText = text.match(/https?:\/\/[^\s]+/i);
    rawUrl =
      fromText?.[0] ??
      (text.toLowerCase().startsWith("http") ? (text.split(/\s+/)[0] ?? "") : "");
  }

  const origin = new URL(request.url).origin;
  const locale = "de";
  const dest = new URL(`/${locale}/recipe-import`, origin);
  if (rawUrl) {
    dest.searchParams.set("url", rawUrl);
  }

  return NextResponse.redirect(dest);
}
