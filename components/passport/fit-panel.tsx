import { useLocale, useTranslations } from "next-intl";
import { ArrowRight, CircleDashed } from "lucide-react";
import { LEVER_LABELS } from "@/lib/ai/levers";
import type { FitTable, PassportDetail } from "@/lib/queries/passports";
import { DemoBadge, GradeBadge } from "@/components/cell/grade-badge";
import { DocumentLink } from "@/components/advisor/document-link";
import { InsufficientState } from "@/components/sheet/ui";
import { formatDate } from "@/components/sheet/format";

/**
 * Fit of one passport in every pilot city of its category (fit-v1, computed on the server).
 * Every figure carries its grade and the reading it was read from, and the DEMO badge when that
 * reading is demonstration data. A city whose country has no published consumer reading is hatched
 * and says so: it is never shown as zero.
 */
export function FitPanel({ passport, table }: { passport: PassportDetail; table: FitTable }) {
  const t = useTranslations("passport.fit");
  const locale = useLocale() as "it" | "en";
  const name = (x: { name_it: string; name_en: string }) => (locale === "en" ? x.name_en : x.name_it);
  const share = new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 });
  const one = new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const category = name(passport.category);
  const withFit = table.cities.filter((c) => c.fit != null).length;
  const claimed = new Set<string>(passport.claims);
  const anyImplied = table.levers.some((l) => !claimed.has(l));

  return (
    <section aria-labelledby="fit-title" data-testid="fit-panel" className="space-y-5">
      <div className="space-y-2">
        <h2 id="fit-title" className="t-h2">
          {t("title")}
        </h2>
        <p className="max-w-[75ch] text-sm leading-relaxed text-muted">{t("lead", { category })}</p>
      </div>

      <div className="card space-y-3 p-4 sm:p-5">
        <h3 className="t-label">{t("answers")}</h3>
        {table.levers.length === 0 ? (
          <p className="text-sm leading-relaxed" data-testid="fit-levers-none">
            {t("answersNone")}
          </p>
        ) : (
          <>
            <ul className="flex flex-wrap gap-2" data-testid="fit-levers">
              {table.levers.map((code) => (
                <li key={code} data-lever={code} className="inline-flex min-h-8 items-center gap-2 rounded-full border border-border-strong px-3 text-sm">
                  {LEVER_LABELS[code][locale]}
                  {!claimed.has(code) && <span className="text-[11px] text-muted">{t("implied")}</span>}
                </li>
              ))}
            </ul>
            {anyImplied && <p className="t-meta max-w-[75ch]">{t("impliedLegend", { label: t("implied") })}</p>}
          </>
        )}
      </div>

      {withFit === 0 && (
        <div data-testid="fit-none">
          <InsufficientState title={t("noneTitle")}>
            <p>{t("noneBody", { category })}</p>
          </InsufficientState>
        </div>
      )}

      <div className="card overflow-hidden">
        <p className="t-label num border-b border-border px-4 py-3 sm:px-5" data-testid="fit-summary">
          {t("summary", { withFit, total: table.cities.length })}
        </p>
        <table className="table" data-testid="fit-table">
          <thead>
            <tr>
              <th scope="col" className="pl-4! sm:pl-5!">
                {t("col.city")}
              </th>
              <th scope="col">{t("col.fit")}</th>
              <th scope="col" className="pr-4! sm:pr-5!">
                {t("col.percentile")}
              </th>
            </tr>
          </thead>
          <tbody>
            {table.cities.map((c) => (
              <tr key={c.slug} data-city={c.slug} data-fit={c.fit ? "present" : "missing"}>
                <th scope="row" className="pl-4! sm:pl-5!">
                  <span className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium">{name(c)}</span>
                    <span className="text-[10px] font-medium tracking-[0.14em] text-muted">{c.countryCode}</span>
                  </span>
                  {c.fit?.reading && (
                    <span className="num mt-0.5 block text-xs leading-snug text-muted">
                      {t("reading", {
                        start: formatDate(c.fit.reading.periodStart, locale),
                        end: formatDate(c.fit.reading.periodEnd, locale),
                        mentions: c.fit.reading.mentions,
                      })}
                    </span>
                  )}
                </th>
                {c.fit ? (
                  <>
                    <td>
                      <span className="flex flex-wrap items-center gap-1.5" data-testid="fit-raw">
                        <span className="num text-base font-medium">{share.format(c.fit.raw)}</span>
                        <GradeBadge grade={c.fit.grade} />
                        {c.fit.isDemo && <DemoBadge />}
                      </span>
                    </td>
                    <td className="pr-4! sm:pr-5!">
                      <span className="flex flex-wrap items-center gap-1.5" data-testid="fit-pct">
                        <span className="num">{one.format(c.fit.pct)}</span>
                        <GradeBadge grade={c.fit.grade} />
                        {c.fit.isDemo && <DemoBadge />}
                      </span>
                    </td>
                  </>
                ) : (
                  <td colSpan={2} className="pr-4! sm:pr-5!">
                    <span title={t("noReadingLong")} className="hatched inline-flex min-h-8 items-center gap-2 rounded-[10px] border border-border-strong/60 py-1 pr-1 pl-2 text-[13px] leading-snug font-medium">
                      <CircleDashed aria-hidden strokeWidth={1.5} className="size-4 shrink-0" />
                      <span className="rounded-[7px] bg-surface px-2 py-0.5">{t("noReading")}</span>
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="t-meta max-w-[75ch]">
        {t("noReadingLong")} {t("method", { method: table.methodVersion })}
      </p>

      {withFit > 0 && (
        <DocumentLink href={`/opportunities?passport=${passport.id}`} className="btn btn-ghost group max-sm:w-full" data-testid="fit-to-opportunities">
          {t("toOpportunities")}
          <ArrowRight aria-hidden className="-mr-1 size-4 transition-transform duration-(--dur-base) group-hover:translate-x-0.5" />
        </DocumentLink>
      )}
    </section>
  );
}
