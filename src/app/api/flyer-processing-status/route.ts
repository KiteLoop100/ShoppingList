import { NextResponse } from "next/server";
import { requireSupabaseAdmin } from "@/lib/api/guards";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const flyerId = searchParams.get("flyer_id");
  if (!flyerId) {
    return NextResponse.json({ error: "flyer_id required" }, { status: 400 });
  }

  const supabase = requireSupabaseAdmin();
  if (supabase instanceof NextResponse) return supabase;

  const { data: uploads } = await supabase
    .from("photo_uploads")
    .select("upload_id, status, extracted_data")
    .eq("photo_type", "flyer_pdf")
    .in("status", ["processing", "error"]);

  const upload = (uploads ?? []).find((u) => {
    const ext = u.extracted_data as Record<string, unknown> | null;
    return (
      ext?.flyer_id === flyerId &&
      ext?.total_pages != null &&
      ((ext?.pages_processed as number) ?? 0) < (ext?.total_pages as number)
    );
  });

  if (!upload) {
    return NextResponse.json({ pending: false });
  }

  const ext = upload.extracted_data as {
    flyer_id: string;
    total_pages: number;
    pages_processed: number;
  };

  return NextResponse.json({
    pending: true,
    upload_id: upload.upload_id,
    status: upload.status,
    total_pages: ext.total_pages,
    pages_processed: ext.pages_processed ?? 0,
  });
}
