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
        <h2 className="text-lg font-medium">{t("title")}</h2>
        <p className="text-sm text-muted">{t("lead")}</p>
      </div>
      {filter && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-surface-2 p-3 text-sm">
          <span className="num">{t("filtered", { count: rows.length })}</span>
          <button type="button" onClick={onClear} className="h-11 rounded-full border border-border px-4">
            {t("clear")}
          </button>
        </div>
      )}
      {rows.length === 0 ? (
        <p role="status" className="hatched rounded-[var(--radius-card)] border border-border p-4 text-sm">
          {t("empty")}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-border">
        <table className="w-full min-w-[960px] text-left text-sm" data-testid="ledger">
          <caption className="sr-only">{t("table")}</caption>
          <thead className="bg-surface-2 text-muted">
            <tr>
              {["Indicator", "Series", "Territory", "Period", "Value", "Grade", "Flag", "Source", "Licence", "Ref", "Run", "Method"].map((k) => (
                <th key={k} scope="col" className="px-3 py-2 font-medium whitespace-nowrap">
                  {t(`col${k}` as never)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="num">
            {rows.map((l) => (
              <tr key={l.id} className="border-t border-border align-top">
                <th scope="row" className="px-3 py-2 font-normal">
                  {locale === "en" ? l.indicatorName.en : l.indicatorName.it}
                </th>
                <td className="px-3 py-2 break-all">{l.seriesKey}</td>
                <td className="px-3 py-2">{l.territory}</td>
                <td className="px-3 py-2 whitespace-nowrap">{period(l.periodStart, l.periodEnd)}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {formatValue(l.value, l.unit, locale)} <span className="text-muted">{unit(l.unit)}</span>
                </td>
                <td className="px-3 py-2">
                  <GradeBadge grade={l.grade} />
                </td>
                <td className="px-3 py-2">{l.flag ? <FlagLetters flags={[l.flag]} /> : "-"}</td>
                <td className="px-3 py-2">
                  <a href={l.source.url} target="_blank" rel="noreferrer" className="text-brand-alt underline">
                    {l.source.name}
                  </a>
                </td>
                <td className="px-3 py-2">{l.source.licence ?? "-"}</td>
                <td className="px-3 py-2 break-all">{l.sourceRef ?? "-"}</td>
                <td className="px-3 py-2 whitespace-nowrap">
                  {l.runId != null ? t("run", { id: l.runId, date: l.runFinishedAt ? formatDate(l.runFinishedAt, locale) : t("noRun") }) : t("noRun")}
                </td>
                <td className="px-3 py-2">{l.methodVersion}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Panel title={t("attributions")}>
        <ul className="space-y-1 text-sm">
          <li>{t("attrEurostat")}</li>
          <li>{t("attrIstat")}</li>
          <li>
            {t("attrOsm")}{" "}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer" className="text-brand-alt underline">
              {t("attrOsmLink")}
            </a>
          </li>
          <li>{t("attrOff")}</li>
          <li>
            {t("attrGdelt")}{" "}
            <a href="https://www.gdeltproject.org/" target="_blank" rel="noreferrer" className="text-brand-alt underline">
              gdeltproject.org
            </a>
          </li>
          <li>{t("attrWikimedia")}</li>
          <li>{t("attrBluesky")}</li>
        </ul>
        {/* Eurostat and ISTAT ask that modified data be marked as such, with a non-responsibility note. */}
        <p className="mt-3 text-xs text-muted">{t("attrEurostatMod")}</p>
      </Panel>
    </div>
  );
}
