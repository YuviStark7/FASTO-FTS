import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { FitPanel } from "@/components/passport/fit-panel";
import { PassportForm } from "@/components/passport/passport-form";
import { LEVER_LABELS } from "@/lib/ai/levers";
import { Link } from "@/lib/i18n/navigation";
import { getPassportFit } from "@/lib/queries/passport-fit";
import { getFitTable, getPassportDetail } from "@/lib/queries/passports";

export default async function PassportDetailPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { locale, id: rawId } = await params;
  setRequestLocale(locale);
  const id = /^\d{1,15}$/.test(rawId) ? Number(rawId) : NaN;
  if (!Number.isSafeInteger(id) || id <= 0) notFound();

  const [t, detail, fit, query] = await Promise.all([getTranslations("passport"), getPassportDetail(id), getPassportFit(id), searchParams]);
  if (!detail || !fit) notFound();
  const { passport, categories } = detail;
  const table = await getFitTable(fit);
  const lang = locale === "en" ? "en" : "it";
  const category = lang === "en" ? passport.category.name_en : passport.category.name_it;

  return (
    <div className="page max-w-[1400px] space-y-6">
      <Link href="/passport" className="link inline-flex min-h-11 items-center gap-2 text-sm">
        <ArrowLeft aria-hidden className="size-4" />
        {t("detail.back")}
      </Link>
      <header className="page-header">
        <h1 className="t-h1 break-words">{passport.name}</h1>
        <p className="t-lead">{category}</p>
      </header>

      {query.saved === "1" && (
        <p role="status" className="note max-w-[80ch]" data-testid="passport-saved">
          {t("form.saved")}
        </p>
      )}

      <div className="gap-8 space-y-8 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,30rem)] lg:space-y-0">
        <FitPanel passport={passport} table={table} />

        <section aria-labelledby="passport-data" className="min-w-0 space-y-4">
          <h2 id="passport-data" className="t-h2">
            {passport.canWrite ? t("form.titleEdit") : t("detail.data")}
          </h2>
          {passport.canWrite ? (
            <div className="card p-4 sm:p-6">
              <PassportForm passport={passport} categories={categories} />
            </div>
          ) : (
            <>
              <p role="status" className="note" data-testid="passport-readonly">
                {t("detail.readOnly")}
              </p>
              <dl className="card grid gap-x-8 gap-y-4 p-4 sm:grid-cols-2 sm:p-6" data-testid="passport-summary">
                {(
                  [
                    [t("form.name"), passport.name],
                    [t("form.category"), category],
                    [t("form.priceBand"), passport.priceBand ? t(`bands.${passport.priceBand}`) : t("detail.none")],
                    [t("form.certifications"), passport.certifications.join(", ") || t("detail.noCertifications")],
                    [t("form.format"), passport.format ?? t("detail.none")],
                    [t("form.capacity"), passport.capacity ?? t("detail.none")],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="min-w-0">
                    <dt className="t-label mb-0.5">{label}</dt>
                    <dd className="break-words">{value}</dd>
                  </div>
                ))}
                <div className="sm:col-span-2">
                  <dt className="t-label mb-0.5">{t("form.claims")}</dt>
                  <dd>{passport.claims.map((c) => LEVER_LABELS[c][lang]).join(", ") || t("detail.noClaims")}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="t-label mb-0.5">{t("form.story")}</dt>
                  <dd className="break-words whitespace-pre-line">{passport.story ?? t("detail.none")}</dd>
                </div>
              </dl>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
