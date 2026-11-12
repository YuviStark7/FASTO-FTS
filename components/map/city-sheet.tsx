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
      className="fixed inset-x-0 bottom-0 z-50 max-h-[70dvh] space-y-4 overflow-y-auto rounded-t-[var(--radius-tray)] border-t border-border bg-surface p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.35)] outline-none motion-safe:animate-[fade_200ms_ease-out] lg:inset-x-auto lg:right-6 lg:bottom-6 lg:w-96 lg:rounded-[var(--radius-card)] lg:border"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-2xl font-light tracking-tight">{detail.city}</h2>
          <p className="text-sm text-muted">{detail.category}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("close")}
          className="grid size-11 shrink-0 place-items-center rounded-full bg-surface-2"
        >
          <X aria-hidden className="size-5" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <StatusLabel status={detail.status} />
        {detail.isDemo && <DemoBadge />}
      </div>

      <div>
        <p className="text-xs text-muted">{t("localDemand")}</p>
        {e ? (
          <>
            <p className="num flex items-center gap-2 text-2xl">
              {num(e.value)}
              <GradeBadge grade={e.grade} />
              {e.is_demo && <DemoBadge />}
            </p>
            <p className="num text-sm text-muted">
              {t("interval", { low: num(e.low), high: num(e.high) })} · {t("period", { year: e.period_year })}
            </p>
          </>
        ) : (
          <p className="hatched mt-1 rounded-lg border border-border px-3 py-2 text-sm">{t("demandUnavailable")}</p>
        )}
      </div>

      <Link
        href={`/cell/${detail.categorySlug}/${detail.territorySlug}`}
        className="flex h-12 items-center justify-center rounded-full bg-brand px-6 font-medium text-brand-contrast"
      >
        {t("openCell")}
      </Link>
    </div>
  );
}
