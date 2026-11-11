"use client";
import { useLocale, useTranslations } from "next-intl";
import type { CellSheet } from "@/lib/queries/cell";
import { FigureValue, useFigureText } from "./figure-value";
import { InsufficientState, Labelled, Panel } from "./ui";

export function TerritoryTab({ data }: { data: CellSheet["territoryTab"] }) {
  const t = useTranslations("sheet.territory");
  const tf = useTranslations("sheet.figure");
  const locale = useLocale();
  const text = useFigureText();

  if (!data || data.localDemand.value == null) {
    return (
      <div className="space-y-3">
        <InsufficientState title={tf("insufficient")}>
          <p>{t("insufficient")}</p>
          <p>{t("production")}</p>
        </InsufficientState>
      </div>
    );
  }
  const d = data.localDemand;
  const low = d.low ?? d.value!;
  const high = d.high ?? d.value!;
  const span = high - low;
  // Position of the point estimate inside its interval, for the bar only (display geometry, not a figure).
  const pos = span > 0 ? Math.min(100, Math.max(0, ((d.value! - low) / span) * 100)) : 50;
  const num = (v: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(v);

  return (
    <div className="space-y-4">
      <Panel title={t("localDemand")}>
        <FigureValue figure={d} size="lg" />
        <div
          role="img"
          aria-label={t("interval", { low: text(d, low), high: text(d, high) })}
          className="mt-4"
        >
          <div className="relative h-3 rounded-full bg-surface-2">
            <div className="absolute inset-y-0 rounded-full border-2 border-dotted border-text/60" style={{ left: 0, right: 0 }} />
            <div className="absolute -top-1 h-5 w-1 rounded bg-brand" style={{ left: `calc(${pos}% - 2px)` }} />
          </div>
          <div className="num mt-1 flex justify-between text-xs text-muted">
            <span>
              {t("low")}: {text(d, low)}
            </span>
            <span>
              {t("high")}: {text(d, high)}
            </span>
          </div>
        </div>
        {d.note && <p className="mt-3 text-sm text-muted">{d.note}</p>}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Labelled label={t("perCapita")}>
            <FigureValue figure={data.perCapita} />
          </Labelled>
          <Labelled label={t("base")}>
            <FigureValue figure={data.base} />
          </Labelled>
          {data.population && (
            <Labelled label={t("population")}>
              <FigureValue figure={data.population} />
            </Labelled>
          )}
          {data.touristNights && (
            <Labelled label={t("touristNights")}>
              <FigureValue figure={data.touristNights} />
            </Labelled>
          )}
        </div>
      </Panel>

      <Panel title={t("factors")}>
        <ul className="space-y-3">
          {data.factors.map((f) => (
            <li key={f.key} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="font-medium">{t(`factorNames.${f.key}`)}</span>
              <span className="num text-sm">{t("factorValue", { value: num(f.value), low: num(f.low), high: num(f.high) })}</span>
              {f.missing && (
                <span title={t("missingHint")} className="hatched rounded-md border border-border px-1.5 py-0.5 text-xs font-medium">
                  {t("missing")}
                </span>
              )}
              <span className="w-full text-sm text-muted">
                {t("basis")}: {f.basis}
              </span>
            </li>
          ))}
        </ul>
      </Panel>

      <Panel title={t("years")}>
        <ul className="num flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {Object.entries(data.years).map(([k, y]) => (
            <li key={k}>{t("yearsItem", { name: k, year: y ?? t("yearMissing") })}</li>
          ))}
        </ul>
      </Panel>

      <p className="rounded-[var(--radius-card)] border border-border p-4 text-sm">{t("production")}</p>
    </div>
  );
}
