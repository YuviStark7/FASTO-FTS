import { setRequestLocale } from "next-intl/server";
import { getOpportunities } from "@/lib/queries/opportunities";
import { OpportunitiesView } from "@/components/opportunities/opportunities-view";

export default async function OpportunitiesPage({ params }: { params: Promise<{ locale: string }> }) {
  setRequestLocale((await params).locale);
  const data = await getOpportunities();
  return <OpportunitiesView {...data} />;
}
