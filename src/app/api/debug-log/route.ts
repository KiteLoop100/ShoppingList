// #region agent log — debug relay endpoint (session 4c9d8e)
import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const logPath = path.join(process.cwd(), "debug-4c9d8e.log");
    const entry = JSON.stringify({ ...body, _relay: true, _relayTs: Date.now() }) + "\n";
    fs.appendFileSync(logPath, entry);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
// #endregion
