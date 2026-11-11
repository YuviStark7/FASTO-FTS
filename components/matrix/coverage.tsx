import { useTranslations } from "next-intl";
import { LineChart, MapPin, MessageSquare, Store, type LucideIcon } from "lucide-react";
import type { CellRow } from "@/lib/queries/matrix";
import { cn } from "@/lib/utils";
import { cellKey, localName, type ViewModel } from "./model";

/** The four inputs a cell needs. Order is the display order. */
export const INPUT_KEYS = ["trend", "geo", "csi", "competition"] as const;
export type InputKey = (typeof INPUT_KEYS)[number];

const INPUT_ICON: Record<InputKey, LucideIcon> = { trend: LineChart, geo: MapPin, csi: MessageSquare, competition: Store };

/** Missing inputs of a cell. A cell that does not exist counts as missing all four, never as zero. */
export function missingOf(cell: CellRow | undefined): InputKey[] {
  if (!cell) return [...INPUT_KEYS];
  const m = new Set(cell.missing_inputs ?? []);
  return INPUT_KEYS.filter((k) => m.has(k));
}

export type GapSummary = {
  perCategory: Map<number, number>;
  perCity: Map<number, number>;
  total: number;
};

/** Counts of missing inputs over the cells currently shown. Pure counting, no scoring. */
export function summariseGaps(model: ViewModel): GapSummary {
  const perCategory = new Map<number, number>();
  const perCity = new Map<number, number>();
  let total = 0;
  for (const { category } of model.rows) {
    for (const col of model.cols) {
      const cell = model.byKey.get(cellKey(category.id, col.id));
      if (!model.matches(cell)) continue;
      const n = missingOf(cell).length;
      total += n;
      perCategory.set(category.id, (perCategory.get(category.id) ?? 0) + n);
      perCity.set(col.id, (perCity.get(col.id) ?? 0) + n);
    }
  }
  return { perCategory, perCity, total };
}

/** Accessible name for a cell in coverage mode: coverage and the missing inputs, in words. */
export function useCoverageLabel() {
  const t = useTranslations("matrix");
  const ti = useTranslations("inputs");
  return (cell: CellRow) => {
    const miss = missingOf(cell);
    return {
      coverage: Math.round(Number(cell.coverage_pct)),
      text: miss.length
        ? t("coverageMissing", { coverage: Math.round(Number(cell.coverage_pct)), inputs: miss.map((k) => ti(k)).join(", ") })
        : t("coverageComplete", { coverage: Math.round(Number(cell.coverage_pct)) }),
    };
  };
}

/** Thin coverage bar and one small icon per missing input (each with a visible title and the words in the link name). */
export function CoverageCell({ cell, compact = false }: { cell: CellRow; compact?: boolean }) {
  const ti = useTranslations("inputs");
  const pct = Math.max(0, Math.min(100, Number(cell.coverage_pct)));
  const miss = missingOf(cell);
  return (
    <span className="flex w-full flex-col items-center gap-1 px-1">
      <span aria-hidden className="h-1 w-full overflow-hidden rounded-full bg-border">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </span>
      <span aria-hidden className={cn("flex items-center justify-center gap-0.5", compact ? "h-4" : "h-5")}>
        {miss.length === 0 ? (
          <span className="num text-[10px] text-muted">{Math.round(pct)}%</span>
        ) : (
          miss.map((k) => {
            const Icon = INPUT_ICON[k];
            return <span key={k} title={ti(k)}><Icon className="size-3.5 text-muted" aria-hidden /></span>;
          })
        )}
      </span>
    </span>
  );
}

/** Per-city and per-category counts of missing inputs: the "data gap map" summary. */
export function GapSummaryList({ model, summary, locale }: { model: ViewModel; summary: GapSummary; locale: string }) {
  const t = useTranslations("matrix");
  return (
    <section aria-label={t("gapSummary")} className="space-y-3 rounded-[var(--radius-card)] border border-border bg-surface p-4 sm:hidden">
      <h2 className="text-sm font-medium">{t("gapSummary")}</h2>
      <p className="num text-sm text-muted">{t("gapTotal", { count: summary.total })}</p>
      <ul data-testid="gap-summary-cities" className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
        {model.cols.map((col) => (
          <li key={col.id} className="flex justify-between gap-2">
            <span className="truncate">{localName(col, locale)}</span>
            <span className="num text-muted">{summary.perCity.get(col.id) ?? 0}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
