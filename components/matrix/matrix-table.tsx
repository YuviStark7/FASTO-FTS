import { useTranslations } from "next-intl";
import { Link } from "@/lib/i18n/navigation";
import { CategoryIcon } from "@/components/cell/category-icon";
import { statusIcon } from "@/components/cell/status";
import { cn } from "@/lib/utils";
import { CoverageCell, type GapSummary, summariseGaps, useCoverageLabel } from "./coverage";
import { cellClass, type ColourMode } from "./cell-style";
import { cellKey, localName, type Highlight, type ViewModel } from "./model";

/**
 * Tablet and desktop grid: a real table. It scrolls inside its own box (both axes), headers stay put,
 * and the page itself never scrolls sideways. Hidden on phones, where MatrixList takes over.
 */
export function MatrixTable({ model, mode, locale, highlight }: { model: ViewModel; mode: ColourMode; locale: string; highlight?: Highlight | null }) {
  const t = useTranslations("matrix");
  const s = useTranslations("status");
  const sc = useTranslations("scout");
  const covLabel = useCoverageLabel();
  const coverage = mode === "coverage";
  const summary: GapSummary | null = coverage ? summariseGaps(model) : null;
  // A thicker rule where a new country starts: cities of one country share the national trend.
  const startsCountry = (i: number) => i > 0 && model.cols[i].country_code !== model.cols[i - 1].country_code;

  return (
    <div className="relative hidden sm:block">
    {/* Fade on the right edge: the grid scrolls sideways inside its box. */}
    <div aria-hidden className="pointer-events-none absolute inset-y-px right-px z-40 w-12 rounded-r-[var(--radius-card)] bg-gradient-to-l from-surface to-transparent" />
    <div className="card relative max-h-[calc(100dvh-20rem)] min-h-72 overflow-auto">
      <table aria-label={t("gridLabel")} className="border-separate border-spacing-0 text-sm">
        <thead>
          <tr>
            <th
              scope="col"
              className="t-label sticky top-0 left-0 z-30 min-w-56 border-r border-b border-border bg-surface px-4 py-3 text-left"
            >
              {t("category")}
            </th>
            {model.cols.map((col, i) => (
              <th
                key={col.id}
                scope="col"
                className={cn("sticky top-0 z-20 min-w-24 border-b border-border bg-surface px-2 py-2.5 text-center text-[13px] font-medium", startsCountry(i) && "border-l-2")}
              >
                <span className="block truncate">{localName(col, locale)}</span>
                <span className="block text-[10px] leading-4 font-medium tracking-[0.14em] text-muted">{col.country_code}</span>
              </th>
            ))}
            {summary && (
              <th scope="col" className="t-label sticky top-0 z-20 min-w-24 border-b border-l border-border bg-surface px-2 py-2.5 text-center">
                {t("missingInputs")}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {model.rows.map(({ category }) => (
            <tr key={category.id} className="group/row">
              <th
                scope="row"
                className="sticky left-0 z-10 border-r border-b border-border bg-surface px-4 py-1.5 text-left font-medium transition-colors duration-(--dur-fast) group-hover/row:bg-surface-2"
              >
                <span className="flex items-center gap-2.5">
                  <span
                    aria-hidden
                    className="grid size-7 shrink-0 place-items-center rounded-[var(--radius-chip)] text-on-category"
                    style={{ backgroundColor: category.color }}
                  >
                    <CategoryIcon name={category.icon} className="size-4" />
                  </span>
                  {localName(category, locale)}
                </span>
              </th>
              {model.cols.map((col, i) => {
                const cell = model.byKey.get(cellKey(category.id, col.id));
                if (!cell || !model.matches(cell)) {
                  return (
                    <td key={col.id} className={cn("border-b border-border p-1 text-center text-muted/50 transition-colors duration-(--dur-fast) group-hover/row:bg-surface-2/60", startsCountry(i) && "border-l-2")} title={t("filteredOut")}>
                      <span aria-hidden>·</span>
                    </td>
                  );
                }
                const Icon = statusIcon(cell.status);
                const label = sc("pair", { category: localName(category, locale), territory: localName(col, locale) });
                const status = s(cell.status);
                return (
                  <td key={col.id} className={cn("border-b border-border p-1 transition-colors duration-(--dur-fast) group-hover/row:bg-surface-2/60", startsCountry(i) && "border-l-2")}>
                    <Link
                      href={`/cell/${category.slug}/${col.slug}`}
                      aria-label={coverage ? `${label}: ${status}, ${covLabel(cell).text}` : `${label}: ${status}`}
                      title={t("tooltip", { name: label, status, coverage: Math.round(cell.coverage_pct) })}
                      aria-current={highlight?.category === category.slug && highlight.territory === col.slug ? "true" : undefined}
                        data-matrix-target={highlight?.category === category.slug && highlight.territory === col.slug ? "" : undefined}
                      className={cn(
                        "relative grid h-11 min-w-20 place-items-center rounded-[10px] border transition-[scale,border-color,box-shadow] duration-(--dur-fast) hover:z-[5] hover:scale-[1.06] hover:border-current hover:shadow-e2 focus-visible:z-[5] active:scale-100",
                        cellClass(cell.status, cell.mos, mode),
                        highlight?.category === category.slug && highlight.territory === col.slug && "ring-2 ring-text ring-offset-2 ring-offset-surface",
                      )}
                    >
                      {coverage ? <CoverageCell cell={cell} /> : <Icon aria-hidden className="size-4" />}
                    </Link>
                  </td>
                );
              })}
              {summary && (
                <td data-testid="gap-category-count" className="num border-b border-l border-border px-2 text-center transition-colors duration-(--dur-fast) group-hover/row:bg-surface-2/60">
                  {summary.perCategory.get(category.id) ?? 0}
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {summary && (
          <tfoot>
            <tr data-testid="gap-city-row">
              <th scope="row" className="t-label sticky left-0 z-10 border-r border-border bg-surface px-4 py-3 text-left">
                {t("missingInputs")}
              </th>
              {model.cols.map((col) => (
                <td key={col.id} className="num px-2 py-2 text-center">
                  {summary.perCity.get(col.id) ?? 0}
                </td>
              ))}
              <td className="num border-l border-border px-2 py-2 text-center font-medium">{summary.total}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
    </div>
  );
}
