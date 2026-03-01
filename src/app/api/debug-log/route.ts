import { NextResponse } from "next/server";
import { appendFileSync } from "fs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const logLine = JSON.stringify(body) + "\n";
    appendFileSync("debug-5f58ab.log", logLine);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
