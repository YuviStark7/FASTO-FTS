"use client";
import { useLocale, useTranslations } from "next-intl";
import type { CellSheet } from "@/lib/queries/cell";
import { GradeBadge } from "@/components/cell/grade-badge";
import { FlagLetters } from "./figure-value";
import { formatDate, formatValue } from "./format";
import { Panel } from "./ui";

export function SourcesTab({ ledger, filter, onClear }: { ledger: CellSheet["ledger"]; filter: number[] | null; onClear: () => void }) {
  const t = useTranslations("sheet.sources");
  const tu = useTranslations("sheet.units");
  const locale = useLocale();
  const want = filter ? new Set(filter) : null;
  const rows = want ? ledger.filter((l) => want.has(l.id)) : ledger;
  const period = (a: string, b: string) => (a === b ? formatDate(a, locale) : `${a.slice(0, 4)}${a.slice(0, 4) === b.slice(0, 4) ? "" : `-${b.slice(0, 4)}`}`);
  const unit = (u: string) => (tu.has(u as never) ? tu(u as never) : u);

  return (
    <div className="space-y-4">
      <div>
        <h2 className="t-h2">{t("title")}</h2>
        <p className="mt-1 max-w-[75ch] text-sm leading-relaxed text-muted">{t("lead")}</p>
      </div>
      {filter && (
        <div className="note flex animate-[fade_var(--dur-base)_var(--ease-out)] flex-wrap items-center justify-between gap-3 border-border-strong bg-surface-2 py-2 pr-2">
          <span className="num">{t("filtered", { count: rows.length })}</span>
          <button type="button" onClick={onClear} className="btn btn-ghost">
            {t("clear")}
          </button>
        </div>
      )}
      {rows.length === 0 ? (
        <p role="status" className="hatched rounded-[var(--radius-card)] border border-border-strong/60 p-5 text-sm font-medium">
          {t("empty")}
        </p>
      ) : null}
      {/* relative: screen-reader-only spans inside the table stay inside the scroll box and never widen the page. */}
      <div className="card relative overflow-x-auto">
        <table className="table min-w-[1040px]" data-testid="ledger">
          <caption className="sr-only">{t("table")}</caption>
          <thead className="bg-surface-2/60">
            <tr>
              {["Indicator", "Series", "Territory", "Period", "Value", "Grade", "Flag", "Source", "Licence", "Ref", "Run", "Method"].map((k) => (
                <th key={k} scope="col">
                  {t(`col${k}` as never)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((l) => (
              <tr key={l.id}>
                <th scope="row" className="min-w-40">
                  {locale === "en" ? l.indicatorName.en : l.indicatorName.it}
                </th>
                <td className="min-w-52 font-mono text-xs leading-5 break-all text-muted">{l.seriesKey}</td>
                <td>{l.territory}</td>
                <td className="whitespace-nowrap">{period(l.periodStart, l.periodEnd)}</td>
                <td className="whitespace-nowrap">
                  {formatValue(l.value, l.unit, locale)} <span className="text-muted">{unit(l.unit)}</span>
                </td>
                <td>
                  <GradeBadge grade={l.grade} />
                </td>
                <td>{l.flag ? <FlagLetters flags={[l.flag]} /> : "-"}</td>
                <td className="whitespace-nowrap">
                  <a href={l.source.url} target="_blank" rel="noreferrer" className="link">
                    {l.source.name}
                  </a>
                </td>
                <td className="text-muted">{l.source.licence ?? "-"}</td>
                <td className="font-mono text-xs leading-5 break-all text-muted">{l.sourceRef ?? "-"}</td>
                <td className="whitespace-nowrap">
                  {l.runId != null ? t("run", { id: l.runId, date: l.runFinishedAt ? formatDate(l.runFinishedAt, locale) : t("noRun") }) : t("noRun")}
                </td>
                <td className="font-mono text-xs leading-5 whitespace-nowrap">{l.methodVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Panel title={t("attributions")}>
        <ul className="space-y-1.5 text-sm leading-relaxed">
          <li>{t("attrEurostat")}</li>
          <li>{t("attrIstat")}</li>
          <li>
            {t("attrOsm")}{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="link">
              {t("attrOsmLink")}
            </a>
          </li>
          <li>{t("attrOff")}</li>
          <li>
            {t("attrGdelt")}{" "}
            <a href="https://www.gdeltproject.org/" target="_blank" rel="noreferrer" className="link">
              gdeltproject.org
            </a>
          </li>
          <li>{t("attrWikimedia")}</li>
          <li>{t("attrBluesky")}</li>
        </ul>
        {/* Eurostat and ISTAT ask that modified data be marked as such, with a non-responsibility note. */}
        <p className="mt-4 border-t border-border pt-3 text-xs leading-relaxed text-muted">{t("attrEurostatMod")}</p>
      </Panel>
    </div>
  );
}
