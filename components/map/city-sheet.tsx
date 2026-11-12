"use client";
import { useEffect, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatValue } from "@/components/sheet/format";
import { X } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import { DemoBadge, GradeBadge } from "@/components/cell/grade-badge";
import { StatusLabel, type CellStatus } from "@/components/cell/status";
import type { GeoEstimate } from "@/lib/queries/map";

export type CityDetail = {
  city: string;
  category: string;
  categorySlug: string;
  territorySlug: string;
  status: CellStatus;
  isDemo: boolean;
  estimate: GeoEstimate | null;
};

/** Bottom sheet on phones, side card on desktop. Not modal: the map and list stay usable behind it. */
export function CitySheet({ detail, onClose }: { detail: CityDetail; onClose: () => void }) {
  const t = useTranslations("map");
  const locale = useLocale();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [detail.territorySlug, onClose]);

  const e = detail.estimate;
  // Rounded: the estimate is grade B, euro-level digits would claim false precision.
  const num = (n: number) => formatValue(n, e?.unit ?? "EUR", locale);
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="dialog"
      aria-label={`${t("sheetLabel")}: ${detail.city}`}
      data-testid="city-sheet"
      className="fixed inset-x-0 bottom-0 z-50 max-h-[70dvh] space-y-5 overflow-y-auto rounded-t-[var(--radius-tray)] border-t border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-e3 outline-none motion-safe:animate-[sheet-in_var(--dur-slow)_var(--ease-out)] lg:inset-x-auto lg:right-8 lg:bottom-8 lg:w-96 lg:rounded-[var(--radius-tray)] lg:border lg:p-6"
    >
      <div aria-hidden className="mx-auto -mt-1 h-1 w-10 rounded-full bg-border-strong lg:hidden" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="t-label">{detail.category}</p>
          <h2 className="mt-1 text-[1.75rem] leading-tight font-light tracking-[-0.025em]">{detail.city}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2 text-muted transition-colors duration-(--dur-fast) hover:bg-surface-3 hover:text-text"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <StatusLabel status={detail.status} />
        {detail.isDemo && <DemoBadge />}
      </div>

      <div>
        <p className="t-label mb-1">{t("localDemand")}</p>
        {e ? (
          <>
            <p className="t-figure flex items-center gap-2.5 text-[2rem]">
              {num(e.value)}
              <GradeBadge grade={e.grade} />
              {e.is_demo && <DemoBadge />}
            </p>
            <p className="num mt-1 text-sm text-muted">
              {t("interval", { low: num(e.low), high: num(e.high) })} · {t("period", { year: e.period_year })}
            </p>
          </>
        ) : (
          <p className="hatched mt-1 rounded-[var(--radius-tile)] border border-border-strong/60 px-4 py-3 text-sm font-medium">{t("demandUnavailable")}</p>
        )}
      </div>

      <Link
        href={`/cell/${detail.categorySlug}/${detail.territorySlug}`}
        className="btn btn-primary h-12 w-full text-[15px]"
      >
        {t("openCell")}
      </Link>
    </div>
  );
}
