"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { CellSheet } from "@/lib/queries/cell";
import { LineChartBox } from "@/components/charts/line-chart";
import { GradeBadge } from "@/components/cell/grade-badge";
import { FigureValue } from "./figure-value";
import { formatValue } from "./format";
import { InsufficientState, Labelled, Panel } from "./ui";

export function MarketTab({ market }: { market: CellSheet["market"] }) {
  const t = useTranslations("sheet.market");
  const locale = useLocale();
  const tf = useTranslations("sheet.figure");
  const [table, setTable] = useState(false);

  if (!market || market.status === "insufficient_data" || market.series.length < 2) {
    return (
      <div className="space-y-3">
        <InsufficientState title={tf("insufficient")}>
          <p>{t("insufficient")}</p>
          <p className="text-muted">{t("ruleInsufficient")}</p>
          {market?.reason && <Technical label={t("technical")} text={market.reason} />}
          <p>{t("national")}</p>
        </InsufficientState>
      </div>
    );
  }

  const eur = (v: number) => formatValue(v, "EUR", locale);
  const first = market.series[0];
  const last = market.series.at(-1)!;
  const data = market.series.map((p) => ({ year: p.year, nominal: p.nominal, volume: p.volume, priceIndex: p.priceIndex }));
  const grade = market.seriesGrade;

  return (
    <div className="space-y-4">
      <p className="t-meta">{t("national")}</p>
      <Panel>
        {/* One lead figure, three supporting ones. */}
        <Labelled label={t("realCagr")}>
          <FigureValue figure={market.realValueCagr} size="lg" />
        </Labelled>
        <div className="mt-4 grid gap-x-6 gap-y-4 border-t border-border pt-4 sm:grid-cols-3">
          <Labelled label={t("volumeCagr")}>
            <FigureValue figure={market.volumeCagr} />
          </Labelled>
          <Labelled label={t("nominalCagr")}>
            <FigureValue figure={market.nominalValueCagr} />
          </Labelled>
          <Labelled label={t("latestNominal")}>
            <FigureValue figure={market.latestNominal} />
          </Labelled>
        </div>
        <p className="mt-5 rounded-[var(--radius-tile)] bg-surface-2 px-4 py-3 text-sm leading-relaxed">
          <span className="text-muted">{t("rule")}: </span>
          {t(market.status === "expanding" ? "ruleExpanding" : market.status === "threatened" ? "ruleThreatened" : "ruleConsolidated", {
            real: formatValue(market.realValueCagr.value ?? 0, "ratio_per_year", locale),
            volume: formatValue(market.volumeCagr.value ?? 0, "ratio_per_year", locale),
            period: market.realValueCagr.period,
          })}
        </p>
        <Technical label={t("technical")} text={market.reason} />
      </Panel>

      <Panel title={t("chartTitle")}>
        <p className="mb-5 flex max-w-[75ch] items-start gap-2.5 text-sm leading-relaxed">
          {grade && <span className="mt-0.5"><GradeBadge grade={grade} /></span>}
          <span>
            {t("chartSummary", {
              first: first.year,
              last: last.year,
              nominalFrom: eur(first.nominal),
              nominalTo: eur(last.nominal),
              volumeFrom: eur(first.volume),
              volumeTo: eur(last.volume),
            })}
          </span>
        </p>
        {table ? (
          <div className="overflow-x-auto">
            <table className="table num">
              <caption className="sr-only">{t("tableCaption")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("year")}</th>
                  <th scope="col">{t("nominal")}</th>
                  <th scope="col">{t("volume")}</th>
                  <th scope="col">{t("priceIndex")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.year}>
                    <th scope="row">{r.year}</th>
                    <td>{eur(r.nominal)}</td>
                    <td>{eur(r.volume)}</td>
                    <td>{formatValue(r.priceIndex, "index", locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <LineChartBox
            data={data}
            xKey="year"
            format={eur}
            series={[
              { key: "nominal", label: t("nominal"), color: "var(--chart-1)" },
              { key: "volume", label: t("volume"), color: "var(--chart-2)", dash: "6 4" },
            ]}
          />
        )}
        <button type="button" aria-pressed={table} onClick={() => setTable(!table)} className="btn btn-ghost mt-4">
          {table ? t("showChart") : t("showTable")}
        </button>
      </Panel>

      {!table && (
        <Panel title={t("priceTitle")}>
          <LineChartBox
            data={data}
            xKey="year"
            height={140}
            format={(v) => formatValue(v, "index", locale)}
            series={[{ key: "priceIndex", label: t("priceIndex"), color: "var(--chart-3)" }]}
          />
        </Panel>
      )}
    </div>
  );
}

/** The stored rule text is the method's audit trail (English, as written by trend-v1). */
function Technical({ label, text }: { label: string; text: string }) {
  return (
    <details className="group mt-2 text-xs text-muted">
      <summary className="-ml-1 inline-flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-1 transition-colors duration-(--dur-fast) hover:text-text">
        <ChevronRight aria-hidden className="size-3.5 transition-transform duration-(--dur-base) group-open:rotate-90" />
        {label}
      </summary>
      <p className="rounded-[var(--radius-tile)] bg-surface-2 px-3 py-2 font-mono text-[11px] leading-relaxed break-words text-text">{text}</p>
    </details>
  );
}
