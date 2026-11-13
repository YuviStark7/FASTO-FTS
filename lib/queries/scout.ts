import "server-only";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

type Tables = Database["public"]["Tables"];
export type Category = Pick<Tables["categories"]["Row"], "id" | "slug" | "name_it" | "name_en" | "color" | "icon">;
export type Territory = Pick<Tables["territories"]["Row"], "id" | "slug" | "name_it" | "name_en" | "country_code">;
export type CellRow = Pick<
  Tables["cells"]["Row"],
  "category_id" | "territory_id" | "status" | "mos" | "mos_grade" | "mos_is_partial" | "coverage_pct" | "grade_mix" | "missing_inputs" | "is_demo"
>;

export async function getScoutData() {
  const { supabase } = await requireUser();
  const [categories, territories, cells] = await Promise.all([
    supabase.from("categories").select("id, slug, name_it, name_en, color, icon").order("sort_order"),
    supabase
      .from("territories")
      .select("id, slug, name_it, name_en, country_code")
      .eq("is_pilot", true)
      .order("sort_order"),
    supabase
      .from("cells")
      .select("category_id, territory_id, status, mos, mos_grade, mos_is_partial, coverage_pct, grade_mix, missing_inputs, is_demo"),
  ]);
  const error = categories.error ?? territories.error ?? cells.error;
  if (error) throw new Error(error.message);
  return {
    categories: categories.data as Category[],
    territories: territories.data as Territory[],
    cells: cells.data as CellRow[],
  };
}
