import type { SupabaseClient } from "@supabase/supabase-js";

export async function generateNextAgCode(supabase: SupabaseClient): Promise<string> {
  const { data } = await supabase
    .from("demand_groups")
    .select("code")
    .like("code", "AG%")
    .order("code", { ascending: false })
    .limit(1);

  if (!data || data.length === 0) return "AG01";

  const lastCode = data[0].code;
  const num = parseInt(lastCode.replace("AG", ""), 10);
  if (isNaN(num)) return "AG01";

  const next = num + 1;
  return `AG${String(next).padStart(2, "0")}`;
}
