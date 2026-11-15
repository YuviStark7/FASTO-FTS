import { setRequestLocale } from "next-intl/server";
import { getScoutData } from "@/lib/queries/scout";
import { ScoutIntroPetals } from "@/components/cell/scout-intro";
import { ScoutView } from "@/components/cell/scout-view";

export default async function ScoutPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ c?: string; t?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { c, t } = await searchParams;
  const data = await getScoutData();
  return (
    <>
      <ScoutIntroPetals categories={data.categories} />
      <ScoutView {...data} initialCategory={c} initialTerritory={t} />
    </>
  );
}
