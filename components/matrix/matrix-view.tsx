"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Category, CellRow, Territory } from "@/lib/queries/matrix";
import { GapSummaryList, summariseGaps } from "./coverage";
import { MatrixControls, type Filters } from "./controls";
import { MatrixLegend } from "./legend";
import { MatrixTable } from "./matrix-table";
import { MatrixList } from "./matrix-list";
import { cellKey, type ViewModel } from "./model";

type Props = { categories: Category[]; territories: Territory[]; cells: CellRow[] };

const INITIAL: Filters = { mode: "status", country: "", status: "", sort: "category" };

const NOTE = "rounded-[var(--radius-card)] border border-border bg-surface px-4 py-3 text-sm";

/** Matrix screen: all filtering and sorting runs in the browser on the 300 cells already loaded. */
export function MatrixView({ categories, territories, cells }: Props) {
  const t = useTranslations("matrix");
  const locale = useLocale();
  const [filters, setFilters] = useState<Filters>(INITIAL);

  const model = useMemo<ViewModel>(() => {
    const byKey = new Map(cells.map((c) => [cellKey(c.category_id, c.territory_id), c]));
    const cols = territories.filter((x) => !filters.country || x.country_code === filters.country);
    const matches = (c: CellRow | undefined) => !!c && (!filters.status || c.status === filters.status);
    let rows = categories
      .map((cat) => {
        const own = cols.map((col) => byKey.get(cellKey(cat.id, col.id)));
        return {
          category: cat,
          withData: own.filter((c) => c && c.status !== "insufficient_data").length,
          total: own.length,
          hasMatch: own.some(matches),
        };
      })
      .filter((r) => r.hasMatch);
    if (filters.sort === "coverage") rows = [...rows].sort((a, b) => b.withData - a.withData); // stable: ties keep category order
    const colsShown = filters.status
      ? cols.filter((col) => rows.some((r) => matches(byKey.get(cellKey(r.category.id, col.id)))))
      : cols;
    return { rows, cols: colsShown, byKey, matches };
  }, [categories, territories, cells, filters]);

  const countries = useMemo(() => [...new Set(territories.map((x) => x.country_code))], [territories]);
  const shown = model.rows.length * model.cols.length;
  const allInsufficient = cells.length > 0 && cells.every((c) => c.status === "insufficient_data");
  const mosMissing = cells.every((c) => c.mos === null);

  return (
    <div className="mx-auto max-w-[1800px] space-y-4 px-4 py-6 lg:px-8 lg:py-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-light tracking-tight lg:text-4xl">{t("title")}</h1>
        <p className="text-muted">{t("lead")}</p>
      </header>

      {cells.length === 0 ? (
        <p role="status" className="rounded-[var(--radius-card)] border border-border bg-surface p-6 text-muted">
          {t("empty")}
        </p>
      ) : (
        <>
          {allInsufficient && filters.mode === "status" && (
            <p role="status" className={NOTE}>
              {t("allInsufficient")}
            </p>
          )}
          {filters.mode === "mos" && mosMissing && (
            <p role="status" className={NOTE}>
              {t("mosUnavailable")}
            </p>
          )}
          <MatrixControls filters={filters} onChange={setFilters} onReset={() => setFilters(INITIAL)} countries={countries} />
          <MatrixLegend mode={filters.mode} mosMissing={mosMissing} />
          <p className="num text-sm text-muted" aria-live="polite">
            {t("cellsShown", { count: shown })}
          </p>
          {shown === 0 ? (
            <div role="status" className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-6">
              <p>{t("noMatch")}</p>
              <button onClick={() => setFilters(INITIAL)} className="h-11 rounded-full bg-brand px-6 text-brand-contrast">
                {t("reset")}
              </button>
            </div>
          ) : (
            <>
              <MatrixTable model={model} mode={filters.mode} locale={locale} />
              <MatrixList model={model} mode={filters.mode} locale={locale} />
              {filters.mode === "coverage" && <GapSummaryList model={model} summary={summariseGaps(model)} locale={locale} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
