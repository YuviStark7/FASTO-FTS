import { useTranslations } from "next-intl";
import type { Fact } from "@/lib/ai/brief/types";
import { GradeBadge } from "@/components/cell/grade-badge";
import { cn } from "@/lib/utils";
import { factAnchor } from "@/lib/advisor/anchor";

/** Grade beside a figure. A figure without a grade is shown as unknown (hatched), never bare. */
export function FactGrade({ grade }: { grade: Fact["grade"] }) {
  const t = useTranslations("advisor");
  if (!grade) return <span className="hatched rounded-[6px] px-1.5 py-0.5 text-[11px] font-medium text-text">{t("noGrade")}</span>;
  return (
    <span className="inline-flex items-center gap-1.5">
      <GradeBadge grade={grade} />
      {grade === "C" && <span className="text-xs text-muted italic">{t("indicative")}</span>}
    </span>
  );
}

/**
 * "Fonti e cifre": every cited figure with its grade, period, method and source.
 * Each row is the focus target of the markers that cite it.
 */
export function FactsList({ facts, scope, className, compact = false }: { facts: Fact[]; scope: string; className?: string; compact?: boolean }) {
  const t = useTranslations("advisor");
  if (!facts.length) return null;
  return (
    <section className={className} aria-label={t("factsTitle")} data-testid="facts-list">
      <h3 className="t-label mb-2">{t("factsTitle")}</h3>
      <ul className={cn("divide-y divide-border rounded-[var(--radius-tile)] border border-border", compact ? "bg-surface-2/50" : "bg-surface")}>
        {facts.map((f) => (
          <li
            key={f.id}
            id={factAnchor(scope, f.id)}
            tabIndex={-1}
            data-testid="fact"
            className={cn(
              "scroll-mt-28 px-3 py-2.5 transition-colors duration-(--dur-base) first:rounded-t-[var(--radius-tile)] last:rounded-b-[var(--radius-tile)] focus:bg-surface-2 focus:outline-2 focus:-outline-offset-2 focus:outline-(--focus) sm:px-4",
              f.grade === "C" && "border-dotted",
            )}
          >
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
              <span className="num w-7 shrink-0 text-xs font-semibold text-muted">{f.id}</span>
              <span className="min-w-0 flex-1 basis-40 text-sm">{f.label}</span>
              <span className="flex items-center gap-2">
                <span className={cn("num text-sm font-medium", f.grade === "C" && "italic")}>{f.display}</span>
                <FactGrade grade={f.grade} />
              </span>
            </div>
            <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 pl-9.5 text-xs text-muted">
              <div className="flex gap-1">
                <dt>{t("period")}:</dt>
                <dd className="num text-text">{f.period}</dd>
              </div>
              <div className="flex gap-1">
                <dt>{t("method")}:</dt>
                <dd className="text-text">{f.method}</dd>
              </div>
              <div className="flex gap-1">
                <dt>{t("source")}:</dt>
                <dd className="text-text">{f.source}</dd>
              </div>
            </dl>
          </li>
        ))}
      </ul>
    </section>
  );
}
