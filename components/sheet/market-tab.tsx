"use client";
import { useState } from "react";
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
          {market?.reason && <p className="text-muted">{market.reason}</p>}
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
      <p className="text-sm text-muted">{t("national")}</p>
      <Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <Labelled label={t("realCagr")}>
            <FigureValue figure={market.realValueCagr} size="lg" />
          </Labelled>
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
        <p className="mt-4 text-sm">
          <span className="text-muted">{t("rule")}: </span>
          {market.reason}
        </p>
      </Panel>

      <Panel title={t("chartTitle")}>
        <p className="mb-3 flex items-start gap-2 text-sm">
          {grade && <GradeBadge grade={grade} />}
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
            <table className="num w-full text-sm">
              <caption className="sr-only">{t("tableCaption")}</caption>
              <thead className="text-left text-muted">
                <tr>
                  <th scope="col" className="py-1 pr-3">{t("year")}</th>
                  <th scope="col" className="py-1 pr-3">{t("nominal")}</th>
                  <th scope="col" className="py-1 pr-3">{t("volume")}</th>
                  <th scope="col" className="py-1">{t("priceIndex")}</th>
                </tr>
              </thead>
              <tbody>
                {data.map((r) => (
                  <tr key={r.year} className="border-t border-border">
                    <th scope="row" className="py-1 pr-3 text-left font-normal">{r.year}</th>
                    <td className="py-1 pr-3">{eur(r.nominal)}</td>
                    <td className="py-1 pr-3">{eur(r.volume)}</td>
                    <td className="py-1">{formatValue(r.priceIndex, "index", locale)}</td>
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
              { key: "nominal", label: t("nominal"), color: "var(--brand-alt)" },
              { key: "volume", label: t("volume"), color: "var(--text)", dash: "6 4" },
            ]}
          />
        )}
        <button type="button" aria-pressed={table} onClick={() => setTable(!table)} className="mt-3 h-11 rounded-full border border-border px-5 text-sm">
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
            series={[{ key: "priceIndex", label: t("priceIndex"), color: "var(--consolidated)" }]}
          />
        </Panel>
      )}
    </div>
  );
}
