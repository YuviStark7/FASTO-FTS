import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getCellSheet } from "@/lib/queries/cell";
import { SheetView } from "@/components/sheet/sheet-view";

export default async function CellPage({ params }: { params: Promise<{ locale: string; category: string; territory: string }> }) {
  const { locale, category, territory } = await params;
  setRequestLocale(locale);
  const sheet = await getCellSheet(category, territory);
  if (!sheet) notFound();
  return <SheetView sheet={sheet} />;
}
