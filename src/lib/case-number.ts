import { supabaseAdmin } from "@/lib/supabase/admin";

export async function generateCaseNumber(): Promise<string> {
  const sb = supabaseAdmin();
  const { count, error } = await sb
    .from("cases")
    .select("*", { count: "exact", head: true });
  if (error) {
    console.error("[case-number] count failed:", error.message);
  }
  const next = (count ?? 0) + 1;
  return `CASE-${String(next).padStart(5, "0")}`;
}
