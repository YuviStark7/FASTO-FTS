"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { ChevronDown } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { CategoryIcon } from "@/components/cell/category-icon";
import { statusIcon } from "@/components/cell/status";
import { cn } from "@/lib/utils";
import { cellClass, type ColourMode } from "./cell-style";
import { cellKey, localName, type ViewModel } from "./model";

/** Phone: categories as a list; one expands into a horizontal strip of territory dots. */
export function MatrixList({ model, mode, locale }: { model: ViewModel; mode: ColourMode; locale: string }) {
  const t = useTranslations("matrix");
  const s = useTranslations("status");
  const sc = useTranslations("scout");
  const [open, setOpen] = useState<number | null>(null);

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
                <span className="num block text-xs text-muted">{t("withData", { count: withData, total })}</span>
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
                        aria-label={`${label}: ${status}`}
                        title={t("tooltip", { name: label, status, coverage: Math.round(cell.coverage_pct) })}
                        className="flex flex-col items-center gap-1 py-1"
                      >
                        <span
                          className={cn("grid size-11 place-items-center rounded-full border", cellClass(cell.status, cell.mos, mode))}
                        >
                          <Icon aria-hidden className="size-5" />
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
