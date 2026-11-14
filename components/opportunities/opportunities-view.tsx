"use client";
import { useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CircleDashed } from "lucide-react";
import { Link } from "@/lib/i18n/navigation";
import type { OpportunitiesData, OpportunityRow, WeightSet } from "@/lib/queries/opportunities";
import { toCellComponents, type Grade } from "@/lib/queries/mos-shape";
import { COMPONENTS, REQUIRED, rankByMos, scoreMos, type ComponentKey } from "@/lib/scoring/mos";
import { CategoryIcon } from "@/components/cell/category-icon";
import { DemoBadge, GradeBadge } from "@/components/cell/grade-badge";
import { cn } from "@/lib/utils";
import { SEGMENT, normaliseWeights, sameWeights, toSliders, type Sliders } from "./weights";
import { WeightPanel } from "./weight-panel";

/** One row as shown: the stored snapshot under the default weights, or the what-if result. */
type Shown = {
  row: OpportunityRow;
  mos: number | null;
  grade: Grade | null;
  isPartial: boolean;
  coveragePct: number;
  rank: number | null;
  points: Partial<Record<ComponentKey, number>>;
  /** Why there is no score: a required input is missing, or the weights leave nothing to score. */
  why: "inputs" | "weights" | null;
};

// Table layout from 85rem up: one row per cell, the coverage label under the score.
const GRID = "wide:grid wide:grid-cols-[2.5rem_minmax(0,1fr)_9.5rem_6.5rem_repeat(5,5.75rem)] wide:items-center wide:gap-x-3 wide:gap-y-0.5";
const COMPONENT_COL = ["wide:col-start-5", "wide:col-start-6", "wide:col-start-7", "wide:col-start-8", "wide:col-start-9"];
const PAGE = 30;

/**
 * Opportunities: ranked cells with their MOS, grade and component bars.
 * The what-if weights re-rank in the browser with `scoreMos` on the percentiles already loaded
 * (the only arithmetic the browser does, SPEC section 6). Moving a slider never calls the server.
 */
export function OpportunitiesView({ rows, defaultWeights, weightSets, canSave }: OpportunitiesData) {
  const t = useTranslations("opportunities");
  const locale = useLocale();
  const [sliders, setSliders] = useState<Sliders>(() => toSliders(defaultWeights));
  const [sets, setSets] = useState<WeightSet[]>(weightSets);
  const [category, setCategory] = useState("");
  const [country, setCountry] = useState("");
  const [limit, setLimit] = useState(PAGE);
  const [allInsufficient, setAllInsufficient] = useState(false);

  const name = (x: { name_it: string; name_en: string }) => (locale === "en" ? x.name_en : x.name_it);
  const one = useMemo(() => new Intl.NumberFormat(locale, { minimumFractionDigits: 1, maximumFractionDigits: 1 }), [locale]);
  const pct = useMemo(() => new Intl.NumberFormat(locale, { style: "percent", maximumFractionDigits: 1 }), [locale]);

  const inputs = useMemo(() => rows.map((row) => ({ row, components: toCellComponents(row.components) })), [rows]);
  const weights = useMemo(() => normaliseWeights(sliders), [sliders]);
  const isDefault = weights != null && sameWeights(weights, defaultWeights);

  const shown = useMemo<Shown[]>(() => {
    const missingRequired = (row: OpportunityRow) => REQUIRED.some((k) => !row.components[k].present);
    if (isDefault) {
      // Default weights: the stored snapshot as it is, nothing recomputed.
      return inputs.map(({ row }) => ({
        row,
        ...row.stored,
        points: Object.fromEntries(COMPONENTS.flatMap((k) => (row.components[k].contribution == null ? [] : [[k, row.components[k].contribution]]))),
        why: row.stored.mos == null ? "inputs" : null,
      }));
    }
    const results = inputs.map(({ row, components }) => ({ row, r: weights ? scoreMos(components, weights) : null }));
    const ranks = rankByMos(new Map(results.map(({ row, r }) => [row.key, r?.mos ?? null])));
    return results.map(({ row, r }) => ({
      row,
      mos: r?.mos ?? null,
      grade: r?.grade ?? null,
      isPartial: r?.isPartial ?? true,
      coveragePct: r?.coveragePct ?? 0,
      rank: ranks.get(row.key) ?? null,
      points: r?.contributions ?? {},
      why: r?.mos != null ? null : missingRequired(row) ? "inputs" : "weights",
    }));
  }, [inputs, weights, isDefault]);

  const categories = useMemo(() => [...new Map(rows.map((r) => [r.category.slug, r.category])).values()], [rows]);
  const countries = useMemo(() => [...new Set(rows.map((r) => r.territory.country_code))].filter((c): c is string => !!c), [rows]);

  const visible = shown.filter((s) => (!category || s.row.category.slug === category) && (!country || s.row.territory.country_code === country));
  const ranked = visible.filter((s) => s.mos != null && s.grade != null).sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0));
  const insufficient = visible.filter((s) => s.mos == null || s.grade == null);
  const dirty = category !== "" || country !== "";
  const resetFilters = () => {
    setCategory("");
    setCountry("");
  };

  const header = (
    <header className="page-header">
      <h1 className="t-h1">{t("title")}</h1>
      <p className="t-lead">{t("lead")}</p>
    </header>
  );

  if (rows.length === 0) {
    return (
      <div className="page max-w-[1600px] space-y-5">
        {header}
        <div role="status" className="hatched flex max-w-2xl flex-col overflow-hidden rounded-[var(--radius-card)] border border-border-strong/60 shadow-e1 sm:flex-row">
          <div aria-hidden className="grid h-14 shrink-0 place-items-center sm:h-auto sm:w-24">
            <CircleDashed strokeWidth={1.5} className="size-7 text-text" />
          </div>
          <div className="m-1.5 flex-1 space-y-3 rounded-[14px] bg-surface p-4 sm:p-5">
            <p className="text-lg leading-snug font-medium tracking-[-0.01em]">{t("empty.title")}</p>
            <p className="text-sm leading-relaxed">{t("empty.body")}</p>
            <Link href="/matrix" className="btn btn-ghost">
              {t("empty.matrix")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page max-w-[1600px] space-y-5 max-lg:pb-28">
      {header}
      <div className="gap-8 lg:grid lg:grid-cols-[19rem_minmax(0,1fr)]">
        <WeightPanel
          sliders={sliders}
          weights={weights}
          isDefault={isDefault}
          defaultWeights={defaultWeights}
          sets={sets}
          canSave={canSave}
          onChange={setSliders}
          onSaved={(s) => setSets((prev) => [...prev, s])}
        />

        <div className="min-w-0 space-y-5">
          <section aria-label={t("filters")} className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end sm:gap-4">
            <label className="block">
              <span className="t-label mb-1.5 block">{t("category")}</span>
              <select className="field sm:w-auto sm:min-w-52" value={category} onChange={(e) => { setCategory(e.target.value); setLimit(PAGE); }}>
                <option value="">{t("allCategories")}</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {name(c)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="t-label mb-1.5 block">{t("country")}</span>
              <select className="field sm:w-auto sm:min-w-44" value={country} onChange={(e) => { setCountry(e.target.value); setLimit(PAGE); }}>
                <option value="">{t("allCountries")}</option>
                {countries.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            {dirty && (
              <button type="button" onClick={resetFilters} className="btn col-span-2 px-4 text-brand-alt hover:bg-surface-2 sm:col-span-1">
                {t("reset")}
              </button>
            )}
          </section>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="t-label num" aria-live="polite" data-testid="opp-summary">
              {t("summary", { ranked: ranked.length, insufficient: insufficient.length })}
            </p>
            {!isDefault && (
              <span data-testid="whatif-badge" className="rounded-full border border-border-strong px-2.5 py-0.5 text-[11px] font-semibold tracking-[0.08em] uppercase">
                {t("whatIf.badge")}
              </span>
            )}
          </div>
          {!isDefault && weights && (
            <p role="status" className="note max-w-[80ch]">
              {t("whatIf.note")}
            </p>
          )}
          {!weights && (
            <p role="status" className="note max-w-[80ch]">
              {t("weights.allZero")}
            </p>
          )}

          {visible.length === 0 ? (
            <div role="status" className="card space-y-4 p-6">
              <p>{t("noMatch")}</p>
              <button type="button" onClick={resetFilters} className="btn btn-primary">
                {t("reset")}
              </button>
            </div>
          ) : (
            <>
              {ranked.length === 0 ? (
                weights && (
                  <p role="status" className="card p-6 text-muted">
                    {t("noRanked")}
                  </p>
                )
              ) : (
                <div className="wide:overflow-hidden wide:rounded-[var(--radius-card)] wide:border wide:border-border wide:bg-surface wide:shadow-e1">
                  <div aria-hidden className={cn("t-label hidden border-b border-border px-5 py-3", GRID)}>
                    <span>{t("col.rank")}</span>
                    <span>{t("col.cell")}</span>
                    <span>{t("col.mos")}</span>
                    <span>{t("col.bar")}</span>
                    {COMPONENTS.map((k) => (
                      <span key={k} className="flex items-center gap-1.5 truncate">
                        <span className={cn("size-2 shrink-0 rounded-[3px]", SEGMENT[k])} />
                        <span className="truncate">{t(`components.${k}`)}</span>
                      </span>
                    ))}
                  </div>
                  <ol aria-label={t("listLabel")} data-testid="opp-list" className="space-y-2.5 wide:space-y-0">
                    {ranked.slice(0, limit).map((s) => (
                      <RankedRow key={s.row.key} s={s} name={name} one={one} pct={pct} />
                    ))}
                  </ol>
                </div>
              )}
              {ranked.length > limit && (
                <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="btn btn-ghost max-sm:w-full">
                  {t("showMore", { count: Math.min(PAGE, ranked.length - limit) })}
                </button>
              )}

              {insufficient.length > 0 && (
                <section aria-labelledby="opp-insufficient" data-testid="opp-insufficient" className="space-y-3 pt-4">
                  <div className="space-y-1">
                    <h2 id="opp-insufficient" className="t-h2">
                      {t("insufficient.title")}
                    </h2>
                    <p className="t-meta">{t("insufficient.lead")}</p>
                  </div>
                  <ul className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                    {(allInsufficient ? insufficient : insufficient.slice(0, 9)).map(({ row, why }) => (
                      <li key={row.key}>
                        <Link
                          href={`/cell/${row.category.slug}/${row.territory.slug}?tab=opportunity`}
                          prefetch={false}
                          className="hatched card-link flex h-full overflow-hidden rounded-[var(--radius-tile)] border border-border-strong/60"
                        >
                          <span aria-hidden className="grid w-11 shrink-0 place-items-center">
                            <CircleDashed strokeWidth={1.5} className="size-5 text-text" />
                          </span>
                          <span className="m-1 flex-1 rounded-[10px] bg-surface px-3 py-2.5">
                            <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              {name(row.category)}, {name(row.territory)}
                              {row.isDemo && <DemoBadge />}
                            </span>
                            <span className="mt-0.5 block text-[13px] leading-snug">
                              {why === "weights"
                                ? t("insufficient.weights")
                                : t("insufficient.missing", {
                                    inputs: REQUIRED.filter((k) => !row.components[k].present)
                                      .map((k) => t(`components.${k}`))
                                      .join(", "),
                                  })}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  {!allInsufficient && insufficient.length > 9 && (
                    <button type="button" onClick={() => setAllInsufficient(true)} className="btn btn-ghost max-sm:w-full">
                      {t("insufficient.showAll", { count: insufficient.length })}
                    </button>
                  )}
                </section>
              )}
            </>
          )}
          <p className="t-meta max-w-[90ch]">{t("methodNote", { method: rows[0].methodVersion })}</p>
        </div>
      </div>
    </div>
  );
}

function RankedRow({
  s,
  name,
  one,
  pct,
}: {
  s: Shown;
  name: (x: { name_it: string; name_en: string }) => string;
  one: Intl.NumberFormat;
  pct: Intl.NumberFormat;
}) {
  const t = useTranslations("opportunities");
  const { row } = s;
  const parts = COMPONENTS.filter((k) => s.points[k] != null);
  const label = (k: ComponentKey) => t(`components.${k}`);
  return (
    <li data-testid="opp-row" data-key={row.key} className="card wide:rounded-none wide:border-0 wide:border-b wide:border-border wide:bg-transparent wide:shadow-none wide:last:border-b-0">
      <Link
        href={`/cell/${row.category.slug}/${row.territory.slug}?tab=opportunity`}
        // No prefetch: a re-rank must not make the browser fetch the rows that scroll into view.
        prefetch={false}
        className={cn(
          "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-3 rounded-[var(--radius-card)] p-4 transition-colors duration-(--dur-fast) -outline-offset-2 hover:bg-surface-2/60 wide:rounded-none wide:px-5 wide:py-3",
          GRID,
        )}
      >
        <span className="num t-figure text-xl text-muted wide:col-start-1 wide:row-span-2 wide:row-start-1" data-testid="opp-rank">
          <span className="sr-only">{t("rank", { rank: s.rank ?? 0 })}</span>
          <span aria-hidden>{s.rank}</span>
        </span>

        <span className="flex min-w-0 items-center gap-3 wide:col-start-2 wide:row-span-2 wide:row-start-1">
          <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-[12px] text-on-category wide:size-8 wide:rounded-[var(--radius-chip)]" style={{ backgroundColor: row.category.color }}>
            <CategoryIcon name={row.category.icon} className="size-5 wide:size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-medium">{name(row.category)}</span>
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted">
              <span className="truncate">{name(row.territory)}</span>
              <span className="text-[10px] font-medium tracking-[0.14em]">{row.territory.country_code}</span>
              {row.isDemo && <DemoBadge />}
            </span>
          </span>
        </span>

        <span className="flex items-center gap-2 wide:col-start-3 wide:row-start-1 wide:self-end" data-testid="opp-mos">
          <span className="t-figure text-[1.75rem] wide:text-2xl">{one.format(s.mos!)}</span>
          <GradeBadge grade={s.grade!} />
        </span>

        <span className="col-span-3 text-[13px] leading-snug wide:col-span-1 wide:col-start-3 wide:row-start-2 wide:self-start wide:text-xs" data-testid="opp-coverage">
          <span className="font-medium">{s.isPartial ? t("partial") : t("complete")}</span>
          <span className="text-muted before:content-['_·_']">{t("coverage", { pct: pct.format(s.coveragePct / 100) })}</span>
        </span>

        <span
          role="img"
          aria-label={t("barLabel", { parts: parts.map((k) => t("componentPoints", { name: label(k), value: one.format(s.points[k]!) })).join(", ") })}
          className="col-span-3 flex h-2 gap-px overflow-hidden rounded-full bg-surface-3 wide:col-span-1 wide:col-start-4 wide:row-span-2 wide:row-start-1"
        >
          {parts.map((k) => (
            <span key={k} className={cn("h-full transition-[width] duration-(--dur-slow)", SEGMENT[k])} style={{ width: `${Math.max(0, Math.min(100, s.points[k]!))}%` }} />
          ))}
        </span>

        <ul className="col-span-3 flex flex-wrap gap-x-4 gap-y-2 text-[13px] wide:contents">
          {COMPONENTS.map((k, i) => {
            const c = row.components[k];
            const points = s.points[k];
            return (
              <li key={k} className={cn("flex items-center gap-1.5 wide:row-span-2 wide:row-start-1", COMPONENT_COL[i])}>
                <span aria-hidden className={cn("size-2 shrink-0 rounded-[3px] wide:hidden", SEGMENT[k])} />
                <span className="text-muted wide:sr-only">{label(k)}</span>
                {c.present && c.grade && points != null ? (
                  <>
                    <span className="num">{one.format(points)}</span>
                    <GradeBadge grade={c.grade} />
                  </>
                ) : (
                  <abbr title={t("naLong")} className="hatched rounded-[6px] border border-border-strong/60 px-1.5 text-[11px] leading-5 font-medium no-underline">
                    {t("na")}
                  </abbr>
                )}
              </li>
            );
          })}
        </ul>
      </Link>
    </li>
  );
}
