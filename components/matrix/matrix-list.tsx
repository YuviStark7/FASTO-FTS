"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { CategoryIcon } from "@/components/cell/category-icon";
import { STATUS_TEXT, statusIcon, type CellStatus } from "@/components/cell/status";
import { cn } from "@/lib/utils";
import { CoverageCell, summariseGaps, useCoverageLabel } from "./coverage";
import { cellClass, type ColourMode } from "./cell-style";
import { cellKey, localName, type Highlight, type ViewModel } from "./model";

/** Phone: categories as a list; one expands into a horizontal strip of territory dots. */
export function MatrixList({ model, mode, locale, highlight }: { model: ViewModel; mode: ColourMode; locale: string; highlight?: Highlight | null }) {
  const t = useTranslations("matrix");
  const s = useTranslations("status");
  const sc = useTranslations("scout");
  const [open, setOpen] = useState<number | null>(() => model.rows.find((r) => r.category.slug === highlight?.category)?.category.id ?? null);
  const covLabel = useCoverageLabel();
  const coverage = mode === "coverage";
  const summary = coverage ? summariseGaps(model) : null;

  return (
    <ul data-testid="matrix-list" className="space-y-2 sm:hidden">
      {model.rows.map(({ category, withData, total }) => {
        const expanded = open === category.id;
        const panelId = `strip-${category.id}`;
        return (
          <li key={category.id} className="overflow-hidden rounded-[var(--radius-card)] border border-border bg-surface">
            <button
              type="button"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={() => setOpen(expanded ? null : category.id)}
              className="flex min-h-14 w-full items-center gap-3 px-3 text-left"
            >
              <span
                aria-hidden
                className="grid size-9 shrink-0 place-items-center rounded-xl"
                style={{ backgroundColor: category.color, color: "#0a0c10" }}
              >
                <CategoryIcon name={category.icon} className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block font-medium">{localName(category, locale)}</span>
                <StatusCounts model={model} categoryId={category.id} label={t("withData", { count: withData, total })} />
                {summary && (
                  <span className="num block text-xs text-muted">{t("missingCount", { count: summary.perCategory.get(category.id) ?? 0 })}</span>
                )}
              </span>
              <ChevronDown aria-hidden className={cn("size-5 text-muted transition-transform", expanded && "rotate-180")} />
            </button>
            {expanded && (
              <ul id={panelId} className="no-scrollbar flex gap-1 overflow-x-auto border-t border-border px-2 py-3">
                {model.cols.map((col) => {
                  const cell = model.byKey.get(cellKey(category.id, col.id));
                  if (!cell || !model.matches(cell)) return null;
                  const Icon = statusIcon(cell.status);
                  const label = sc("pair", { category: localName(category, locale), territory: localName(col, locale) });
                  const status = s(cell.status);
                  return (
                    <li key={col.id} className="w-20 shrink-0">
                      <Link
                        href={`/cell/${category.slug}/${col.slug}`}
                        aria-label={coverage ? `${label}: ${status}, ${covLabel(cell).text}` : `${label}: ${status}`}
                        title={t("tooltip", { name: label, status, coverage: Math.round(cell.coverage_pct) })}
                        aria-current={highlight?.category === category.slug && highlight.territory === col.slug ? "true" : undefined}
                        className={cn(
                          "flex flex-col items-center gap-1 rounded-xl py-1",
                          highlight?.category === category.slug && highlight.territory === col.slug && "ring-2 ring-text ring-offset-2 ring-offset-surface",
                        )}
                      >
                        <span
                          className={cn(
                            "grid place-items-center border",
                            coverage ? "h-11 w-16 rounded-lg" : "size-11 rounded-full",
                            cellClass(cell.status, cell.mos, mode),
                          )}
                        >
                          {coverage ? <CoverageCell cell={cell} compact /> : <Icon aria-hidden className="size-5" />}
                        </span>
                        <span aria-hidden className="w-full truncate text-center text-xs">
                          {localName(col, locale)}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
  );
}

const ORDER: CellStatus[] = ["expanding", "consolidated", "threatened", "insufficient_data"];

/** Counts per status for one category, each with its icon (never colour alone); the full sentence is for screen readers. */
function StatusCounts({ model, categoryId, label }: { model: ViewModel; categoryId: number; label: string }) {
  const counts = new Map<CellStatus, number>();
  for (const col of model.cols) {
    const c = model.byKey.get(cellKey(categoryId, col.id));
    if (c) counts.set(c.status, (counts.get(c.status) ?? 0) + 1);
  }
  return (
    <span className="num mt-0.5 flex items-center gap-3 text-xs text-muted">
      <span className="sr-only">{label}</span>
      {ORDER.filter((k) => counts.get(k)).map((k) => {
        const Icon = statusIcon(k);
        return (
          <span key={k} aria-hidden className="inline-flex items-center gap-1">
            <Icon className={cn("size-3.5", STATUS_TEXT[k])} />
            {counts.get(k)}
          </span>
        );
      })}
    </span>
  );
}
