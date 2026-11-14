"use client";
import { useLocale, useTranslations } from "next-intl";
import { ArrowRight } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { CellSheet } from "@/lib/queries/cell";
import { DemoBadge, GradeBadge } from "@/components/cell/grade-badge";
import { FigureValue } from "./figure-value";
import { formatDate, formatValue } from "./format";
import { InsufficientState, Panel } from "./ui";

type Opportunity = NonNullable<CellSheet["opportunity"]>;
type Component = Opportunity["components"][number];

/** A percentile on its 0-100 track. The number is beside it: the bar is never the only signal. */
function Percentile({ value, label }: { value: number; label: string }) {
  return (
    <div role="img" aria-label={label} className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3">
      <div className="h-full origin-left animate-[grow_700ms_var(--ease-out)] rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, value))}%` }} />
    </div>
  );
}

function Missing({ children }: { children: React.ReactNode }) {
  return <span className="hatched inline-flex min-h-8 items-center rounded-[10px] border border-border-strong/60 px-3 text-sm font-medium">{children}</span>;
}

/**
 * Opportunity tab: the stored MOS snapshot (mos-v1) with its grade, coverage and component breakdown.
 * Nothing is computed here. A missing score or component is hatched and named, never a zero.
 */
export function OpportunityTab({ opportunity }: { opportunity: CellSheet["opportunity"] }) {
  const t = useTranslations("sheet.opportunity");
  const locale = useLocale();
  const pct = (v: number) => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }).format(v / 100);
  const points = (v: number) => formatValue(v, "points_0_100", locale);
  const names = (keys: Component["key"][]) => keys.map((k) => t(`names.${k}`)).join(", ");

  const toRanking = (
    <Link href="/opportunities" className="btn btn-ghost group max-sm:w-full">
      {t("toOpportunities")}
      <ArrowRight aria-hidden className="-mr-1 size-4 transition-transform duration-(--dur-base) group-hover:translate-x-0.5" />
    </Link>
  );
  const brief = (
    <Panel title={t("brief")}>
      <p className="text-sm text-muted">{t("briefSoon")}</p>
    </Panel>
  );

  if (!opportunity) {
    return (
      <div className="space-y-4" data-testid="mos-not-computed">
        <InsufficientState title={t("notComputedTitle")}>
          <p>{t("notComputedBody")}</p>
        </InsufficientState>
        {brief}
        {toRanking}
      </div>
    );
  }

  const o = opportunity;
  const scored = o.mos.value != null && o.mos.grade != null;
  const absent = o.components.filter((c) => !c.present).map((c) => c.key);

  return (
    <div className="space-y-4">
      {scored ? (
        <Panel title={t("mos")}>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1" data-testid="mos-figure">
            <FigureValue figure={o.mos} size="lg" />
            {o.isDemo && <DemoBadge />}
          </div>
          <p className="mt-3 flex flex-wrap items-center gap-x-2 text-sm" data-testid="mos-coverage">
            <span className="rounded-full border border-border-strong px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] uppercase">{o.isPartial ? t("partial") : t("complete")}</span>
            <span className="num">{t("coverage", { pct: pct(o.coveragePct) })}</span>
          </p>
          <div
            role="progressbar"
            aria-label={t("coverageLabel")}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(o.coveragePct)}
            className="mt-3 h-1 max-w-md overflow-hidden rounded-full bg-surface-3"
          >
            <div className="h-full rounded-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, o.coveragePct))}%` }} />
          </div>
          {o.isPartial && absent.length > 0 && <p className="mt-3 max-w-[75ch] text-sm leading-relaxed text-muted">{t("partialNote", { inputs: names(absent) })}</p>}
          <p className="num mt-4 border-t border-border pt-4 text-[13px] text-muted">
            {o.rank != null && <>{t("rank", { rank: o.rank })} · </>}
            {t("computed", { date: formatDate(o.computedAt, locale), method: o.mos.methodVersion })}
          </p>
        </Panel>
      ) : (
        <div data-testid="mos-insufficient" className="space-y-2">
          <InsufficientState title={t("insufficientTitle")}>
            <p>{o.missingRequired.length > 0 ? t("insufficientBody", { inputs: names(o.missingRequired) }) : t("insufficientNoInputs")}</p>
            {o.isDemo && (
              <p>
                <DemoBadge />
              </p>
            )}
          </InsufficientState>
        </div>
      )}

      <Panel title={t("components")}>
        <p className="mb-4 max-w-[75ch] text-sm leading-relaxed text-muted">{t("componentsLead")}</p>
        <ul className="divide-y divide-border" data-testid="mos-components">
          {o.components.map((c) => (
            <li key={c.key} data-component={c.key} data-present={c.present} className="space-y-2 py-4 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <div>
                  <span className="font-medium">{t(`names.${c.key}`)}</span>
                  <span className="t-meta ml-2">{t(`what.${c.key}`)}</span>
                </div>
                {c.present && c.contribution != null && <span className="num text-sm font-medium">{t("points", { value: points(c.contribution) })}</span>}
              </div>

              {!c.present ? (
                <div className="space-y-2">
                  <Missing>{t("missing")}</Missing>
                  {c.key === "fit" && <p className="max-w-[75ch] text-sm leading-relaxed text-muted">{t("fitNote")}</p>}
                </div>
              ) : (
                <>
                  {c.figure && <FigureValue figure={c.figure} />}
                  {c.pct != null && c.grade && (
                    <div className="grid max-w-md grid-cols-[1fr_auto] items-center gap-3">
                      <Percentile value={c.pct} label={t("percentileLabel", { name: t(`names.${c.key}`), value: points(c.pct) })} />
                      <span className="num flex items-center gap-1.5 text-[13px]">
                        {t("percentile", { value: points(c.pct) })}
                        <GradeBadge grade={c.grade} />
                      </span>
                    </div>
                  )}
                  {c.parts && (
                    <>
                      <dl className="grid gap-x-8 gap-y-2 pt-1 sm:grid-cols-2">
                        {c.parts.map((p) => (
                          <div key={p.key}>
                            <dt className="t-label mb-0.5">{t(`parts.${p.key}`)}</dt>
                            <dd className="flex flex-wrap items-center gap-x-3">
                              {p.figure.value == null ? <Missing>{t("missing")}</Missing> : <FigureValue figure={p.figure} />}
                              {p.figure.value != null && p.pct != null && <span className="num text-[13px] text-muted">{t("percentile", { value: points(p.pct) })}</span>}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="max-w-[75ch] text-sm leading-relaxed text-muted">{t("pressureNote")}</p>
                    </>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
      </Panel>

      {brief}
      {toRanking}
    </div>
  );
}
