"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { Category, CellRow, Territory } from "@/lib/queries/scout";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import { DemoBadge, type Grade } from "./grade-badge";
import { StatusLabel } from "./status";

type Props = {
  categories: Category[];
  territories: Territory[];
  cells: CellRow[];
  initialCategory?: string;
  initialTerritory?: string;
};

/**
 * Scout (home): pick a category and a territory, get the verdict.
 * Phone: verdict in the centre, selectors in a tray under the thumb.
 * Desktop: selectors in a left panel, verdict on the right. SPEC sections 6 and 7.
 */
export function ScoutView({ categories, territories, cells, initialCategory, initialTerritory }: Props) {
  const t = useTranslations("scout");
  const locale = useLocale();
  const name = useCallback((x: { name_it: string; name_en: string }) => (locale === "en" ? x.name_en : x.name_it), [locale]);

  const [catSlug, setCatSlug] = useState(
    categories.some((c) => c.slug === initialCategory) ? initialCategory! : categories[0]?.slug,
  );
  const [terSlug, setTerSlug] = useState(
    territories.some((x) => x.slug === initialTerritory) ? initialTerritory! : territories[0]?.slug,
  );

  const category = categories.find((c) => c.slug === catSlug)!;
  const territory = territories.find((x) => x.slug === terSlug)!;
  const cell = useMemo(
    () => cells.find((c) => c.category_id === category?.id && c.territory_id === territory?.id),
    [cells, category, territory],
  );

  // Keep the selection in the URL so a verdict can be shared and survives reload.
  useEffect(() => {
    const url = new URL(window.location.href);
    url.searchParams.set("c", catSlug);
    url.searchParams.set("t", terSlug);
    window.history.replaceState(null, "", url);
  }, [catSlug, terSlug]);

  if (!category || !territory) return null;

  return (
    <div className="flex min-h-[calc(100dvh-4.5rem)] flex-col lg:min-h-dvh lg:flex-row">
      {/* Verdict */}
      <section
        aria-live="polite"
        className="flex flex-1 flex-col items-center justify-center gap-6 px-4 pt-10 pb-6 text-center lg:order-2 lg:px-12"
      >
        <Pair category={category} territory={territory} cell={cell} name={name} />
        <Verdict cell={cell} key={`${catSlug}-${terSlug}`} />
      </section>

      {/* Tray (phone) / left panel (desktop) */}
      <section
        aria-label={`${t("categories")}, ${t("territories")}`}
        className={cn(
          "sticky bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-30 rounded-t-[var(--radius-tray)] bg-surface pt-5 pb-4 shadow-[0_-12px_40px_rgba(0,0,0,0.35)]",
          "lg:static lg:order-1 lg:w-[380px] lg:shrink-0 lg:overflow-y-auto lg:rounded-none lg:border-r lg:border-border lg:pt-10 lg:shadow-none",
        )}
      >
        <TokenCarousel
          label={t("pickCategory")}
          items={categories.map((c) => ({ id: c.slug, label: name(c), color: c.color, icon: c.icon }))}
          value={catSlug}
          onChange={setCatSlug}
        />
        <ChipRow
          label={t("pickTerritory")}
          items={territories.map((x) => ({ id: x.slug, label: name(x), meta: x.country_code }))}
          value={terSlug}
          onChange={setTerSlug}
        />
      </section>
    </div>
  );
}

function Pair({
  category,
  territory,
  cell,
  name,
}: {
  category: Category;
  territory: Territory;
  cell?: CellRow;
  name: (x: { name_it: string; name_en: string }) => string;
}) {
  const t = useTranslations("scout");
  const unknown = !cell || cell.status === "insufficient_data";
  // Two cards side by side define the cell. A hatched card means unknown.
  return (
    <div className="flex items-center gap-3" aria-label={t("pair", { category: name(category), territory: name(territory) })}>
      <div
        className="flex h-24 w-20 flex-col items-center justify-center gap-2 rounded-[var(--radius-card)] text-bg shadow-lg transition-transform duration-300"
        style={{ backgroundColor: category.color }}
      >
        <CategoryIcon name={category.icon} className="size-7" />
      </div>
      <div
        className={cn(
          "flex h-24 w-20 flex-col items-center justify-center rounded-[var(--radius-card)] border border-border px-1 text-xs font-medium shadow-lg",
          unknown ? "hatched text-text" : "bg-surface-2",
        )}
      >
        <span className="line-clamp-2">{name(territory)}</span>
        <span className="text-[10px] text-muted">{territory.country_code}</span>
      </div>
    </div>
  );
}

function Verdict({ cell }: { cell?: CellRow }) {
  const t = useTranslations("scout");
  const ts = useTranslations("status");
  const ti = useTranslations("inputs");
  const status = cell?.status ?? "insufficient_data";
  const mix = (cell?.grade_mix ?? { A: 0, B: 0, C: 0 }) as Record<Grade, number>;
  const coverage = Number(cell?.coverage_pct ?? 0);
  const missing = (cell?.missing_inputs ?? []).map((k) => (ti.has(k) ? ti(k) : k));

  return (
    <div className="flex max-w-md animate-[fade_300ms_ease-out] flex-col items-center gap-4">
      <h1 className="text-[40px] leading-tight font-light tracking-tight sm:text-[56px]">{ts(status)}</h1>
      <div className="flex items-center gap-3">
        <StatusLabel status={status} />
        {cell?.is_demo && <DemoBadge />}
      </div>
      <p className="num text-muted">
        {cell?.mos != null ? (
          <>
            {t("mos")} <span className="text-text">{Math.round(Number(cell.mos))}</span>
          </>
        ) : (
          t("mosUnavailable")
        )}
      </p>
      {status === "insufficient_data" && (
        <p className="text-sm text-muted">
          {t("insufficientReason")}
          {missing.length > 0 && <span className="mt-1 block">{t("missing", { inputs: missing.join(", ") })}</span>}
        </p>
      )}
      <div className="mt-2 w-64 space-y-3 text-left text-xs text-muted">
        <ThinBar label={t("coverage")} value={coverage} />
        <GradeMix label={t("gradeMix")} mix={mix} />
      </div>
    </div>
  );
}

function ThinBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className="num">{Math.round(value)}%</span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="h-1 overflow-hidden rounded-full bg-surface-2"
      >
        <div className="h-full rounded-full bg-brand transition-[width] duration-300" style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

function GradeMix({ label, mix }: { label: string; mix: Record<Grade, number> }) {
  const total = mix.A + mix.B + mix.C;
  const pct = (n: number) => (total ? (n / total) * 100 : 0);
  return (
    <div>
      <div className="mb-1 flex justify-between">
        <span>{label}</span>
        <span className="num">
          A {mix.A} · B {mix.B} · C {mix.C}
        </span>
      </div>
      <div aria-hidden className={cn("flex h-1 overflow-hidden rounded-full", total ? "bg-surface-2" : "hatched")}>
        <div className="h-full bg-text" style={{ width: `${pct(mix.A)}%` }} />
        <div className="h-full bg-muted" style={{ width: `${pct(mix.B)}%` }} />
        <div className="h-full bg-border" style={{ width: `${pct(mix.C)}%` }} />
      </div>
    </div>
  );
}

type Token = { id: string; label: string; color: string; icon: string };

/** Round coloured tokens; the selected one is enlarged and scrolled to the centre. Radio-group keyboard model. */
function TokenCarousel({ label, items, value, onChange }: { label: string; items: Token[]; value: string; onChange: (id: string) => void }) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  const selected = items.find((i) => i.id === value);

  useEffect(() => {
    refs.current.get(value)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [value]);

  const onKey = (e: React.KeyboardEvent) => {
    const i = items.findIndex((x) => x.id === value);
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = items[(i + delta + items.length) % items.length];
    onChange(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div className="mb-4">
      <p className="mb-2 px-4 text-center text-sm font-medium lg:px-6 lg:text-left">{selected?.label}</p>
      <div
        role="radiogroup"
        aria-label={label}
        onKeyDown={onKey}
        className="no-scrollbar flex snap-x snap-mandatory items-center gap-3 overflow-x-auto px-[calc(50%-28px)] py-3 lg:flex-wrap lg:overflow-visible lg:px-6"
      >
        {items.map((it) => {
          const active = it.id === value;
          return (
            <button
              key={it.id}
              ref={(el) => {
                if (el) refs.current.set(it.id, el);
              }}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={it.label}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(it.id)}
              className={cn(
                "grid shrink-0 snap-center place-items-center rounded-full text-bg transition-all duration-300 ease-[var(--ease-spring)]",
                active ? "size-14 ring-2 ring-text ring-offset-2 ring-offset-surface" : "size-11 opacity-70 hover:opacity-100",
              )}
              style={{ backgroundColor: it.color }}
            >
              <CategoryIcon name={it.icon} className={active ? "size-6" : "size-5"} />
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ChipRow({
  label,
  items,
  value,
  onChange,
}: {
  label: string;
  items: { id: string; label: string; meta: string }[];
  value: string;
  onChange: (id: string) => void;
}) {
  const refs = useRef(new Map<string, HTMLButtonElement>());
  useEffect(() => {
    refs.current.get(value)?.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
  }, [value]);

  const onKey = (e: React.KeyboardEvent) => {
    const i = items.findIndex((x) => x.id === value);
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = items[(i + delta + items.length) % items.length];
    onChange(next.id);
    refs.current.get(next.id)?.focus();
  };

  return (
    <div role="radiogroup" aria-label={label} onKeyDown={onKey} className="no-scrollbar flex gap-2 overflow-x-auto px-4 lg:flex-wrap lg:px-6">
      {items.map((it) => {
        const active = it.id === value;
        return (
          <button
            key={it.id}
            ref={(el) => {
              if (el) refs.current.set(it.id, el);
            }}
            type="button"
            role="radio"
            aria-checked={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(it.id)}
            className={cn(
              "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-sm transition-colors",
              active ? "bg-brand text-brand-contrast" : "bg-surface-2 text-text hover:bg-border",
            )}
          >
            {it.label}
            <span className={cn("text-[10px]", active ? "opacity-70" : "text-muted")}>{it.meta}</span>
          </button>
        );
      })}
    </div>
  );
}
