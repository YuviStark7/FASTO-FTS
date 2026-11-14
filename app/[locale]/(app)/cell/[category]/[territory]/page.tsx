import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getStaffRole } from "@/lib/admin";
import { getCellSheet } from "@/lib/queries/cell";
import { SheetView, type BriefInfo } from "@/components/sheet/sheet-view";

// The Opportunity tab can generate a brief (a 20-60 s server action).
export const maxDuration = 120;

export default async function CellPage({ params }: { params: Promise<{ locale: string; category: string; territory: string }> }) {
  const { locale, category, territory } = await params;
  setRequestLocale(locale);
  const sheet = await getCellSheet(category, territory, locale === "en" ? "en" : "it");
  if (!sheet) notFound();
  // Brief of this cell, if the user may read it (RLS: published for everyone, drafts for staff).
  const { supabase, role } = await getStaffRole();
  const { data: brief } = await supabase
    .from("briefs")
    .select("id, status")
    .eq("category_id", sheet.category.id)
    .eq("territory_id", sheet.territory.id)
    .maybeSingle();
  const briefInfo: BriefInfo = { canGenerate: role != null, existing: brief ? { id: brief.id, status: brief.status } : null };
  return <SheetView sheet={sheet} brief={briefInfo} />;
}
