import { setRequestLocale } from "next-intl/server";
import { getOpportunities } from "@/lib/queries/opportunities";
import { getPassportFit, listPassports } from "@/lib/queries/passport-fit";
import { OpportunitiesView } from "@/components/opportunities/opportunities-view";

/**
 * `?passport=ID` is the organisation view: the Fit of that passport (fit-v1, computed on the server,
 * read through RLS so only the user's organisation can ask for it) is handed to the screen, which
 * adds it to the rows of the passport's category and re-ranks in the browser. Nothing is stored.
 */
export default async function OpportunitiesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<{ passport?: string | string[] }> }) {
  setRequestLocale((await params).locale);
  const raw = (await searchParams).passport;
  const passportId = typeof raw === "string" && /^\d{1,15}$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
  const [data, passports, fit] = await Promise.all([getOpportunities(), listPassports(), passportId == null ? null : getPassportFit(passportId)]);
  return <OpportunitiesView {...data} passports={passports} fit={fit} passportMissing={raw != null && fit == null} />;
}
