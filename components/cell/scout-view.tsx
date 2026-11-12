"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { Category, CellRow, Territory } from "@/lib/queries/scout";
import { getScoutFigures, type ScoutFigure } from "@/app/[locale]/(app)/scout-actions";
import { Link } from "@/lib/i18n/navigation";
import { cn } from "@/lib/utils";
import { CategoryIcon } from "./category-icon";
import { DemoBadge } from "./grade-badge";
import { ScoutCombobox, type ComboItem } from "./scout-combobox";
import { ScoutFrames } from "./scout-frames";
import { STATUS_TEXT, statusIcon, type CellStatus } from "./status";

// The map screen still uses the round-token carousel.
export { TokenCarousel } from "./token-carousel";

type Props = {
  categories: Category[];
  territories: Territory[];
  cells: CellRow[];
  initialCategory?: string;
  initialTerritory?: string;
};

/** Soft light behind the verdict, in the status colour. Decoration only: the icon and the word carry the status. */
const AURA: Record<CellStatus, string> = {
  expanding: "bg-expanding",
  consolidated: "bg-consolidated",
  threatened: "bg-threatened",
  insufficient_data: "bg-transparent",
};
const PILL = "btn btn-inverse btn-caps h-11 px-6";

const STEP = 24; // 360 / 15 categories: the arc is a slice of a full wheel
const VISIBLE = 4; // petals shown either side of the selected one (96 degrees)

/** Shortest signed distance between two indices on a wheel of n. */
const wrap = (d: number, n: number) => ((((d + n / 2) % n) + n) % n) - n / 2;

/**
 * Scout (home), full-bleed. Two states of one screen:
 * bloomed (choosing): the category flower and two editable tags; collapsed (reading): the verdict,
 * two pills and floating frames with the cell's key figures. SPEC sections 6 and 7.
 */
export function ScoutView({ categories, territories, cells, initialCategory, initialTerritory }: Props) {
  const t = useTranslations("scout");
  const ts = useTranslations("status");
  const locale = useLocale();
  const name = useCallback((x: { name_it: string; name_en: string }) => (locale === "en" ? x.name_en : x.name_it), [locale]);

  const [catSlug, setCatSlug] = useState(
    categories.some((c) => c.slug === initialCategory) ? initialCategory! : categories[0]?.slug,
  );
  const [terSlug, setTerSlug] = useState(
    territories.some((x) => x.slug === initialTerritory) ? initialTerritory! : territories[0]?.slug,
  );
  const catIndex = Math.max(0, categories.findIndex((c) => c.slug === catSlug));
  const [rot, setRot] = useState(-catIndex * STEP); // accumulated wheel angle, so turns take the short way
  const [bloomed, setBloomed] = useState(false);
  const [editing, setEditing] = useState(0);
  const [figures, setFigures] = useState<ScoutFigure[] | null>(null);
  const [loading, setLoading] = useState(true);

  const zone = useRef<HTMLDivElement>(null);
  const petals = useRef(new Map<string, HTMLButtonElement>());
  const catChip = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const inside = useRef(false);
  const mouseSeen = useRef(false);
  const focusPetal = useRef(false);

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

  // Key figures of the selected cell: debounced, previous frames stay until the new ones arrive.
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const id = setTimeout(async () => {
      try {
        const r = await getScoutFigures(catSlug, terSlug, locale);
        if (!cancelled) setFigures(r);
      } catch {
        if (!cancelled) setFigures((prev) => prev ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [catSlug, terSlug, locale]);

  const bloom = useCallback(() => {
    clearTimeout(timer.current);
    setBloomed(true);
  }, []);
  const collapse = useCallback(() => {
    clearTimeout(timer.current);
    setBloomed(false);
  }, []);

  // Tap or click outside, and Escape, collapse the flower.
  useEffect(() => {
    if (!bloomed) return;
    const down = (e: PointerEvent) => {
      if (zone.current && !zone.current.contains(e.target as Node)) collapse();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || editing) return;
      const hadFocus = zone.current?.contains(document.activeElement);
      collapse();
      if (hadFocus) requestAnimationFrame(() => catChip.current?.focus());
    };
    document.addEventListener("pointerdown", down);
    window.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", down);
      window.removeEventListener("keydown", key);
    };
  }, [bloomed, editing, collapse]);

  // After a keyboard bloom, focus goes to the selected petal.
  useEffect(() => {
    if (bloomed && focusPetal.current) {
      focusPetal.current = false;
      requestAnimationFrame(() => petals.current.get(catSlug)?.focus());
    }
  }, [bloomed, catSlug]);

  // If the pointer is already outside when editing ends, collapse after the usual delay.
  useEffect(() => {
    if (bloomed && !editing && mouseSeen.current && !inside.current) {
      timer.current = setTimeout(collapse, 300);
      return () => clearTimeout(timer.current);
    }
  }, [bloomed, editing, collapse]);

  const onEditing = useCallback((on: boolean) => {
    setEditing((n) => Math.max(0, n + (on ? 1 : -1)));
  }, []);

  const selectCategory = useCallback(
    (slug: string) => {
      const next = categories.findIndex((c) => c.slug === slug);
      if (next < 0 || slug === catSlug) return;
      setRot((r) => r - wrap(next - catIndex, categories.length) * STEP);
      setCatSlug(slug);
    },
    [categories, catIndex, catSlug],
  );

  const onPetalKey = (e: React.KeyboardEvent) => {
    const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = categories[(catIndex + delta + categories.length) % categories.length];
    selectCategory(next.slug);
    petals.current.get(next.slug)?.focus();
  };

  const catItems = useMemo<ComboItem[]>(
    () => categories.map((c) => ({ id: c.slug, label: name(c), search: [c.name_it, c.name_en] })),
    [categories, name],
  );
  const terItems = useMemo<ComboItem[]>(
    () => territories.map((x) => ({ id: x.slug, label: name(x), meta: x.country_code, search: [x.name_it, x.name_en] })),
    [territories, name],
  );

  if (!category || !territory) return null;

  const status = cell?.status ?? "insufficient_data";
  const StatusIcon = statusIcon(status);
  const country = territory.country_code ?? "";
  const missing = (cell?.missing_inputs ?? []) as string[];
  const cellHref = `/cell/${category.slug}/${territory.slug}`;
  const mosHref = `/matrix?mode=mos&c=${category.slug}&t=${territory.slug}`;
  const move = "transition-all duration-(--dur-flower) ease-spring motion-reduce:transition-none";

  return (
    <section
      aria-label={t("title")}
      // Full-bleed under the transparent header: cancel the layout's top padding, fill the viewport.
      className="relative isolate -mt-[var(--header-h,96px)] h-dvh min-h-[34rem] overflow-hidden"
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute top-1/2 left-1/2 -z-10 size-[min(70rem,150vw)] -translate-x-1/2 -translate-y-1/2 rounded-full transition-[background-color,opacity,scale] duration-1000 ease-out [mask-image:radial-gradient(closest-side,black,transparent)] motion-reduce:transition-none",
          AURA[status],
          bloomed ? "scale-75 opacity-[0.05]" : "scale-100 opacity-[0.09]",
        )}
      />
      <ScoutFrames figures={figures} loading={loading} visible={!bloomed} href={cellHref} />

      {/* Verdict: upper centre while choosing, vertical centre while reading. */}
      <div
        aria-live="polite"
        className={cn(
          "pointer-events-none absolute left-1/2 z-10 w-full max-w-2xl -translate-x-1/2 px-4 text-center",
          move,
          bloomed ? "top-[calc(var(--header-h,96px)+1rem)] translate-y-0" : "top-1/2 -translate-y-1/2",
        )}
      >
        <div className="flex flex-col items-center gap-4">
          {/* Keyed on the cell: label and status cross-fade when the selection changes. */}
          <div
            key={`${catSlug}:${terSlug}`}
            className={cn(
              "flex origin-top animate-[verdict_420ms_cubic-bezier(0.16,1,0.3,1)] flex-col items-center gap-3 transition-transform duration-(--dur-flower) ease-out motion-reduce:transition-none",
              bloomed && "sm:scale-[0.82]",
            )}
          >
            <p className="flex items-center justify-center gap-2 text-xs font-medium tracking-[0.24em] text-muted uppercase sm:text-[13px]">
              {t("cellName", { category: name(category), territory: name(territory) })}
              {cell?.is_demo && <DemoBadge />}
            </p>
            {/* Status by icon, word and colour together, never colour alone. */}
            <h1 className="t-display flex flex-col items-center gap-3">
              <StatusIcon aria-hidden strokeWidth={1.5} className={cn("size-9 sm:size-12", STATUS_TEXT[status])} />
              <span>{ts(status)}</span>
            </h1>
          </div>
          <div
            className={cn("flex flex-col items-center gap-4", move, bloomed ? "pointer-events-none max-h-0 translate-y-2 overflow-hidden opacity-0" : "max-h-96 opacity-100")}
            inert={bloomed}
          >
            <div className="pointer-events-auto mt-3 flex flex-wrap items-center justify-center gap-3 p-1">
              <Link
                href={cellHref}
                className={cn(PILL, "group")}
              >
                {t("openCell")}
                <ArrowRight aria-hidden className="-mr-1 size-4 transition-transform duration-(--dur-base) group-hover:translate-x-0.5" />
              </Link>
              <Link
                href={mosHref}
                className={cn(PILL, "num")}
              >
                {cell?.mos != null ? t("mosValue", { value: Math.round(Number(cell.mos)) }) : t("mosUnavailable")}
              </Link>
            </div>
            {status !== "insufficient_data" ? (
              <p className="max-w-xs text-xs leading-relaxed text-muted">{t("nationalScope", { country })}</p>
            ) : (
              <p className="max-w-sm text-sm leading-relaxed text-muted">
                {t("insufficientReason")}
                {missing.length > 0 && <MissingInputs keys={missing} />}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Flower zone: the pointer leaving it, a tap outside or Escape collapses it. */}
      <div
        ref={zone}
        data-testid="scout-zone"
        data-state={bloomed ? "bloomed" : "collapsed"}
        onPointerEnter={(e) => {
          if (e.pointerType !== "mouse") return; // touch collapses on a tap outside, never on "leave"
          inside.current = true;
          mouseSeen.current = true;
          bloom();
        }}
        onPointerLeave={(e) => {
          if (e.pointerType !== "mouse") return;
          inside.current = false;
          if (!editing) {
            clearTimeout(timer.current);
            timer.current = setTimeout(collapse, 300);
          }
        }}
        style={{ ["--b" as string]: "calc(var(--R) * 0.1 + var(--p) / 2 + 1.75rem)" }}
        className={cn(
          "absolute bottom-0 left-1/2 z-20 -translate-x-1/2 [--R:150px] [--p:50px] sm:[--R:230px] sm:[--p:70px]",
          bloomed ? "h-[calc(var(--b)+var(--R)+var(--p)+1.5rem)] w-full" : "h-28 w-72",
        )}
      >
        {/* Collapsed chips: category icon and location. Hover or tap blooms the flower again. */}
        <div
          className={cn(
            "absolute bottom-7 left-1/2 flex -translate-x-1/2 items-center gap-3",
            move,
            bloomed ? "pointer-events-none scale-50 opacity-0" : "scale-100 opacity-100",
          )}
          inert={bloomed}
        >
          <button
            ref={catChip}
            type="button"
            aria-label={`${t("bloom")}: ${name(category)}`}
            data-testid="scout-chip-category"
            onClick={(e) => {
              focusPetal.current = e.detail === 0;
              bloom();
            }}
            className="grid size-14 place-items-center rounded-[18px] text-on-category shadow-e2 ring-1 ring-inset ring-white/20 transition-[transform,box-shadow] duration-(--dur-base) hover:-translate-y-0.5 hover:shadow-e3 active:scale-[0.96]"
            style={{ backgroundColor: category.color }}
          >
            <CategoryIcon name={category.icon} className="size-7" />
          </button>
          <button
            type="button"
            aria-label={`${t("bloom")}: ${name(territory)}`}
            data-testid="scout-chip-territory"
            onClick={(e) => {
              focusPetal.current = e.detail === 0;
              bloom();
            }}
            className="flex h-14 min-w-24 flex-col items-center justify-center rounded-[18px] border border-border bg-surface-2 px-5 text-sm font-semibold tracking-[0.1em] uppercase shadow-e2 transition-[transform,box-shadow,background-color,border-color] duration-(--dur-base) hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface-3 hover:shadow-e3 active:scale-[0.96]"
          >
            {name(territory)}
            <span className="text-[10px] leading-3 font-medium tracking-[0.14em] text-muted">{territory.country_code}</span>
          </button>
        </div>

        {/* The flower. */}
        <div
          className={cn("absolute bottom-[var(--b)] left-1/2 size-0 origin-center", move, bloomed ? "scale-100 opacity-100" : "pointer-events-none scale-[0.12] opacity-0")}
          inert={!bloomed}
          data-testid="scout-flower"
        >
          <div
            role="radiogroup"
            aria-label={t("pickCategory")}
            onKeyDown={onPetalKey}
            className="absolute size-0 transition-transform duration-(--dur-flower) ease-in-out motion-reduce:transition-none"
            style={{ transform: `rotate(${rot}deg)` }}
          >
            {categories.map((c, i) => {
              const off = wrap(i - catIndex, categories.length);
              const active = i === catIndex;
              const near = Math.abs(off) <= VISIBLE;
              return (
                <button
                  key={c.slug}
                  ref={(el) => {
                    if (el) petals.current.set(c.slug, el);
                  }}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  aria-label={name(c)}
                  tabIndex={active ? 0 : -1}
                  onClick={() => selectCategory(c.slug)}
                  className={cn(
                    "absolute top-0 left-0 grid place-items-center rounded-[18px] transition-[transform,opacity,background-color,color,box-shadow] duration-(--dur-flower) ease-in-out motion-reduce:transition-none",
                    active
                      ? "text-on-category shadow-e3 ring-1 ring-inset ring-white/20"
                      : "bg-surface-2 text-muted shadow-e1 ring-1 ring-inset ring-border hover:bg-surface-3 hover:text-text",
                    !near && "pointer-events-none",
                  )}
                  style={{
                    width: "var(--p)",
                    height: "var(--p)",
                    marginLeft: "calc(var(--p) / -2)",
                    marginTop: "calc(var(--p) / -2)",
                    backgroundColor: active ? c.color : undefined,
                    opacity: near ? 1 : 0,
                    zIndex: active ? 2 : 1,
                    transform: `rotate(${i * STEP}deg) translateY(calc(var(--R) * -1)) rotate(${-(i * STEP) - rot}deg) scale(${active ? 1.45 : near ? 1 - Math.abs(off) * 0.04 : 0.3})`,
                  }}
                >
                  <CategoryIcon name={c.icon} className="size-6 sm:size-8" />
                </button>
              );
            })}
          </div>

          {/* Category name under the selected petal, editable. */}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: "calc(var(--R) - var(--p) * 0.725 - 3.25rem)" }}>
            <ScoutCombobox
              items={catItems}
              value={catSlug}
              label={t("editCategory")}
              placeholder={t("typeCategory")}
              emptyText={t("noMatches")}
              onPick={selectCategory}
              onEditing={onEditing}
              testId="scout-category-tag"
              triggerClassName="bg-surface/80 whitespace-nowrap backdrop-blur-sm hover:bg-surface-2"
            />
          </div>

          {/* Location chip at the centre of the flower, editable. */}
          <div className="absolute left-1/2 -translate-x-1/2" style={{ bottom: "-1.375rem" }}>
            <ScoutCombobox
              items={terItems}
              value={terSlug}
              label={t("editTerritory")}
              placeholder={t("typeTerritory")}
              emptyText={t("noMatches")}
              onPick={setTerSlug}
              onEditing={onEditing}
              listSide="up"
              testId="scout-territory-tag"
              triggerClassName="border border-border bg-surface-2 whitespace-nowrap shadow-e1 hover:border-border-strong hover:bg-surface-3"
            >
              {name(territory)} <span className="text-[10px] font-medium tracking-[0.14em] text-muted">{territory.country_code}</span>
            </ScoutCombobox>
          </div>
        </div>
      </div>
    </section>
  );
}

function MissingInputs({ keys }: { keys: string[] }) {
  const t = useTranslations("scout");
  const ti = useTranslations("inputs");
  const list = keys.map((k) => (ti.has(k) ? ti(k) : k));
  return <span className="mt-1 block">{t("missing", { inputs: list.join(", ") })}</span>;
}
