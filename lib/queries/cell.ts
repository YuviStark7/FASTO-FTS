import "server-only";
import { CSI_EVIDENCE } from "./evidence";
import { requireUser } from "@/lib/auth";
import type { Database } from "@/lib/database.types";

/**
 * Data contract of the cell sheet (SPEC section 6). Every number the sheet shows is a Figure:
 * it carries its grade, period, method version and the observation ids behind it, so any figure
 * can open its evidence (product rules 1 and 4). The UI never computes a figure.
 */

type Tables = Database["public"]["Tables"];
export type Grade = Database["public"]["Enums"]["grade"];
export type CellStatus = Database["public"]["Enums"]["cell_status"];

export type Figure = {
  value: number | null;
  low?: number | null;
  high?: number | null;
  unit: string;
  grade: Grade | null;
  /** Human period, e.g. "2022", "2017-2022", "1 Jan 2025". */
  period: string;
  methodVersion: string;
  observationIds: number[];
  /** Source status flags present among the inputs (p, e, b, d ...). */
  flags?: string[];
  note?: string | null;
  /** For figures built from mentions rather than observations: id of the in-page provenance panel. */
  evidence?: string;
};

export type LedgerRow = {
  id: number;
  indicator: string;
  indicatorName: { it: string; en: string };
  seriesKey: string;
  territory: string;
  category: string | null;
  periodStart: string;
  periodEnd: string;
  value: number;
  unit: string;
  grade: Grade;
  flag: string | null;
  source: { slug: string; name: string; url: string; licence: string | null };
  sourceRef: string | null;
  runId: number | null;
  runFinishedAt: string | null;
  methodVersion: string;
  isDemo: boolean;
};

export type CellSheet = {
  category: Pick<Tables["categories"]["Row"], "id" | "slug" | "name_it" | "name_en" | "color" | "icon"> & {
    scopeNote: string | null;
  };
  territory: Pick<Tables["territories"]["Row"], "id" | "slug" | "name_it" | "name_en" | "country_code"> & {
    scopeNote: string | null;
    country: { slug: string; name_it: string; name_en: string };
    region: { slug: string; name_it: string; name_en: string } | null;
  };
  cell: { status: CellStatus; coveragePct: number; gradeMix: Record<Grade, number>; missingInputs: string[]; isDemo: boolean; updatedAt: string };
  market: null | {
    scope: "national";
    status: CellStatus;
    reason: string;
    grade: Grade | null;
    window: { first: number | null; last: number | null };
    realValueCagr: Figure;
    volumeCagr: Figure;
    nominalValueCagr: Figure;
    /** Series for the chart. Nominal value and volume are separate lines (product rule 5). */
    series: { year: number; nominal: number; real: number; volume: number; priceIndex: number }[];
    seriesGrade: Grade | null;
    latestNominal: Figure;
  };
  territoryTab: null | {
    localDemand: Figure;
    perCapita: Figure;
    base: Figure;
    factors: {
      key: "income" | "tourism" | "pos";
      value: number;
      low: number;
      high: number;
      basis: string;
      missing: boolean;
    }[];
    years: Record<string, number | null>;
    population: Figure | null;
    touristNights: Figure | null;
  };
  consumers: null | {
    /** Id of the csi_snapshots row behind this reading: the target of human feedback. */
    csiSnapshotId: number | null;
    isDemo: boolean;
    csi: Figure;
    components: { key: "liking" | "desirability" | "trust" | "perceived_value" | "purchase_intent"; figure: Figure }[];
    nMentions: Figure;
    /** Where the mentions behind the reading come from (product rule 4). */
    provenance: {
      sources: { slug: string; name: string; url: string; licence: string | null; mentions: number; lastRun: { id: number; finishedAt: string | null } | null }[];
      scoring: { model: string; promptVersion: string } | null;
    };
    languages: string[];
    period: { start: string; end: string };
    representativenessNote: string;
    published: boolean;
    levers: { label_it: string; label_en: string; share: Figure; mentionCount: number; examples: string[] }[];
    barriers: { label_it: string; label_en: string; share: Figure; mentionCount: number; examples: string[] }[];
  };
  attention: { indicator: "pageviews" | "media_attention"; figure: Figure; series: { period: string; value: number }[] }[];
  competition: {
    assortment: { tag: string; figure: Figure }[];
    offers: {
      productName: string;
      competitor: string | null;
      price: number | null;
      packSize: number | null;
      packUnit: string | null;
      channel: string | null;
      grade: Grade;
      observedOn: string;
      url: string | null;
    }[];
  };
  /** Every observation behind the sheet: the Sources tab (evidence ledger). */
  ledger: LedgerRow[];
};

const year = (d: string) => d.slice(0, 4);

export async function getCellSheet(categorySlug: string, territorySlug: string, locale: "it" | "en" = "it"): Promise<CellSheet | null> {
  const { supabase } = await requireUser();

  const [{ data: category }, { data: territories }] = await Promise.all([
    supabase.from("categories").select("id, slug, name_it, name_en, color, icon, codes").eq("slug", categorySlug).maybeSingle(),
    supabase.from("territories").select("id, slug, name_it, name_en, country_code, level, parent_id, stat_codes, is_pilot"),
  ]);
  const territory = territories?.find((t) => t.slug === territorySlug && t.is_pilot);
  if (!category || !territory) return null;
  const byId = new Map((territories ?? []).map((t) => [t.id, t]));
  const up = (id: number | null, level: string) => {
    let cur = id ? byId.get(id) : undefined;
    while (cur && cur.level !== level) cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
    return cur;
  };
  const region = up(territory.parent_id, "region") ?? null;
  const country = up(territory.parent_id, "country")!;

  const { data: cell } = await supabase
    .from("cells")
    .select("status, coverage_pct, grade_mix, missing_inputs, is_demo, updated_at, trend_snapshot_id, geo_estimate_id, csi_snapshot_id")
    .eq("category_id", category.id)
    .eq("territory_id", territory.id)
    .single();
  if (!cell) return null;

  const [trendRes, geoRes, csiRes, attentionRes, assortmentRes, offersRes] = await Promise.all([
    cell.trend_snapshot_id ? supabase.from("trend_snapshots").select("*").eq("id", cell.trend_snapshot_id).single() : null,
    cell.geo_estimate_id ? supabase.from("geo_estimates").select("*").eq("id", cell.geo_estimate_id).single() : null,
    cell.csi_snapshot_id ? supabase.from("csi_snapshots").select("*").eq("id", cell.csi_snapshot_id).single() : null,
    supabase
      .from("observations")
      .select("id, value, grade, unit, period_start, period_end, status_flag, indicators!inner(slug), territory_id")
      .eq("category_id", category.id)
      .in("territory_id", [territory.id, country.id])
      .in("indicators.slug", ["pageviews", "media_attention"])
      .order("period_start"),
    supabase
      .from("observations")
      .select("id, value, grade, unit, period_start, series_key, indicators!inner(slug)")
      .eq("category_id", category.id)
      .eq("territory_id", country.id)
      .eq("indicators.slug", "product_count")
      .order("period_start", { ascending: false }),
    supabase
      .from("offers")
      .select("product_name, price, pack_size, pack_unit, channel, grade, observed_on, url, competitors(name)")
      .eq("category_id", category.id)
      .in("territory_id", [territory.id, country.id])
      .order("observed_on", { ascending: false })
      .limit(50),
  ]);
  const trend = trendRes?.data ?? null;
  const geo = geoRes?.data ?? null;
  const csi = csiRes?.data ?? null;

  // ---------------------------------------------------------------- ledger: every observation behind the sheet
  const ids = new Set<number>([
    ...(trend?.input_observation_ids ?? []),
    ...(geo?.input_observation_ids ?? []),
    ...(attentionRes.data ?? []).map((o) => o.id),
    ...(assortmentRes.data ?? []).map((o) => o.id),
  ]);
  const ledger = await loadLedger(supabase, [...ids], territories ?? [], category.slug);
  const flagsOf = (obsIds: number[]) => {
    const want = new Set(obsIds);
    return [...new Set(ledger.filter((l) => want.has(l.id) && l.flag).map((l) => l.flag!))];
  };

  const trendIds = trend?.input_observation_ids ?? [];
  const trendPeriod = trend?.first_year ? `${trend.first_year}-${trend.last_year}` : "";
  const series = (trend?.series ?? []) as CellSheet["market"] extends null ? never : NonNullable<CellSheet["market"]>["series"];
  const last = series.at(-1);
  const pct = (v: number | null): Figure => ({
    value: v,
    unit: "ratio_per_year",
    grade: trend?.grade ?? null,
    period: trendPeriod,
    methodVersion: "trend-v1",
    observationIds: trendIds,
    flags: flagsOf(trendIds),
  });

  // Notes in the user's language; the English text is the stored original.
  const codesRaw = (category.codes ?? {}) as { scope_note?: string; scope_note_it?: string };
  const statRaw = (territory.stat_codes ?? {}) as Record<string, string>;
  const codes = { scope_note: locale === "it" ? codesRaw.scope_note_it ?? codesRaw.scope_note : codesRaw.scope_note };
  const statCodes = { ...statRaw, scope_note: locale === "it" ? statRaw.scope_note_it ?? statRaw.scope_note : statRaw.scope_note };
  const factors = (geo?.factors ?? {}) as Record<string, unknown>;
  const geoIds = geo?.input_observation_ids ?? [];
  const pick = (indicator: string) => ledger.filter((l) => geoIds.includes(l.id) && l.indicator === indicator && l.territory === territory.slug).at(-1);
  const popRow = pick("population");
  const nightsRow = pick("tourist_nights");
  const asFigure = (l: LedgerRow | undefined, method = "normalise-v1"): Figure | null =>
    l
      ? { value: l.value, unit: l.unit, grade: l.grade, period: l.periodStart === l.periodEnd ? l.periodStart : year(l.periodStart), methodVersion: method, observationIds: [l.id], flags: l.flag ? [l.flag] : [] }
      : null;

  const attentionBy = (slug: "pageviews" | "media_attention") => {
    const rows = (attentionRes.data ?? []).filter((o) => (o.indicators as unknown as { slug: string }).slug === slug);
    if (!rows.length) return null;
    const lastRow = rows.at(-1)!;
    return {
      indicator: slug,
      figure: {
        value: Number(lastRow.value),
        unit: lastRow.unit,
        grade: lastRow.grade,
        period: lastRow.period_start.slice(0, 7),
        methodVersion: "normalise-v1",
        observationIds: rows.map((r) => r.id),
        flags: [],
      },
      series: rows.map((r) => ({ period: r.period_start.slice(0, 7), value: Number(r.value) })),
    };
  };

  const latestAssortment = new Map<string, NonNullable<typeof assortmentRes.data>[number]>();
  for (const o of assortmentRes.data ?? []) if (!latestAssortment.has(o.series_key)) latestAssortment.set(o.series_key, o);

  return {
    category: { id: category.id, slug: category.slug, name_it: category.name_it, name_en: category.name_en, color: category.color, icon: category.icon, scopeNote: codes.scope_note ?? null },
    territory: {
      id: territory.id,
      slug: territory.slug,
      name_it: territory.name_it,
      name_en: territory.name_en,
      country_code: territory.country_code,
      scopeNote: statCodes.scope_note ?? null,
      country: { slug: country.slug, name_it: country.name_it, name_en: country.name_en },
      region: region ? { slug: region.slug, name_it: region.name_it, name_en: region.name_en } : null,
    },
    cell: {
      status: cell.status,
      coveragePct: Number(cell.coverage_pct),
      gradeMix: cell.grade_mix as Record<Grade, number>,
      missingInputs: cell.missing_inputs,
      isDemo: cell.is_demo,
      updatedAt: cell.updated_at,
    },
    market: trend
      ? {
          scope: "national",
          status: trend.status,
          reason: trend.reason,
          grade: trend.grade,
          window: { first: trend.first_year, last: trend.last_year },
          realValueCagr: pct(trend.real_value_cagr == null ? null : Number(trend.real_value_cagr)),
          volumeCagr: pct(trend.volume_cagr == null ? null : Number(trend.volume_cagr)),
          nominalValueCagr: pct(trend.nominal_value_cagr == null ? null : Number(trend.nominal_value_cagr)),
          series,
          seriesGrade: trend.grade,
          latestNominal: {
            value: last ? last.nominal : null,
            unit: "EUR",
            grade: trend.grade,
            period: last ? String(last.year) : "",
            methodVersion: "trend-v1",
            observationIds: trendIds,
            flags: flagsOf(trendIds),
            note: codes.scope_note ?? null,
          },
        }
      : null,
    territoryTab: geo
      ? {
          localDemand: {
            value: Number(geo.value),
            low: Number(geo.low),
            high: Number(geo.high),
            unit: geo.unit,
            grade: geo.grade,
            period: String(geo.period_year),
            methodVersion: geo.method_version_id,
            observationIds: geoIds,
            flags: flagsOf(geoIds),
            note: statCodes.scope_note ?? null,
          },
          perCapita: { value: Number(factors.per_capita), unit: "EUR_per_capita", grade: "B", period: String(geo.period_year), methodVersion: geo.method_version_id, observationIds: geoIds },
          base: { value: Number(factors.base), unit: "EUR", grade: "B", period: String(geo.period_year), methodVersion: geo.method_version_id, observationIds: geoIds },
          factors: (["income", "tourism", "pos"] as const).map((key) => {
            const f = (factors[key] ?? {}) as { value: number; low: number; high: number; basis: string; missing?: boolean };
            return { key, value: Number(f.value ?? 1), low: Number(f.low ?? 1), high: Number(f.high ?? 1), basis: f.basis ?? "", missing: Boolean(f.missing) };
          }),
          years: (factors.years ?? {}) as Record<string, number | null>,
          population: asFigure(popRow),
          touristNights: asFigure(nightsRow),
        }
      : null,
    consumers: csi
      ? await (async () => {
          const base = {
            grade: csi.grade,
            period: `${csi.period_start} – ${csi.period_end}`,
            methodVersion: csi.method_version_id,
            observationIds: [],
            evidence: CSI_EVIDENCE,
          };
          return {
            csiSnapshotId: csi.id,
            isDemo: csi.is_demo,
            csi: { ...base, value: csi.csi == null ? null : Number(csi.csi), unit: "index_0_100", note: csi.representativeness_note },
            components: (["liking", "desirability", "trust", "perceived_value", "purchase_intent"] as const).map((key) => ({
              key,
              figure: { ...base, value: csi[key] == null ? null : Number(csi[key]), unit: "index_0_100" },
            })),
            nMentions: { ...base, value: csi.n_mentions, unit: "count" },
            languages: csi.languages,
            period: { start: csi.period_start, end: csi.period_end },
            representativenessNote: csi.representativeness_note,
            published: csi.is_published,
            provenance: await loadCsiProvenance(supabase, csi),
            ...(await loadLeversBarriers(supabase, csi.id, base)),
          };
        })()
      : null,
    attention: [attentionBy("pageviews"), attentionBy("media_attention")].filter((x): x is NonNullable<typeof x> => x != null),
    competition: {
      assortment: [...latestAssortment.values()].map((o) => ({
        tag: o.series_key,
        figure: { value: Number(o.value), unit: o.unit, grade: o.grade, period: o.period_start, methodVersion: "normalise-v1", observationIds: [o.id], note: locale === "it" ? "copertura di un database collaborativo, non quota di mercato" : "coverage of a crowd-sourced database, not market size" },
      })),
      offers: (offersRes.data ?? []).map((o) => ({
        productName: o.product_name,
        competitor: (o.competitors as unknown as { name: string } | null)?.name ?? null,
        price: o.price == null ? null : Number(o.price),
        packSize: o.pack_size == null ? null : Number(o.pack_size),
        packUnit: o.pack_unit,
        channel: o.channel,
        grade: o.grade,
        observedOn: o.observed_on,
        url: o.url,
      })),
    },
    ledger,
  };
}

async function loadLedger(
  supabase: Awaited<ReturnType<typeof requireUser>>["supabase"],
  ids: number[],
  territories: { id: number; slug: string }[],
  categorySlug: string,
): Promise<LedgerRow[]> {
  if (!ids.length) return [];
  const terr = new Map(territories.map((t) => [t.id, t.slug]));
  const out: LedgerRow[] = [];
  for (let i = 0; i < ids.length; i += 300) {
    const { data, error } = await supabase
      .from("observations")
      .select(
        "id, category_id, territory_id, series_key, period_start, period_end, value, unit, grade, status_flag, source_ref, run_id, method_version_id, is_demo, indicators(slug, name_it, name_en), sources(slug, name, url, licence), source_runs(finished_at)",
      )
      .in("id", ids.slice(i, i + 300));
    if (error) throw new Error(error.message);
    for (const o of data ?? []) {
      const ind = o.indicators as unknown as { slug: string; name_it: string; name_en: string };
      const src = o.sources as unknown as { slug: string; name: string; url: string; licence: string | null };
      out.push({
        id: o.id,
        indicator: ind.slug,
        indicatorName: { it: ind.name_it, en: ind.name_en },
        seriesKey: o.series_key,
        territory: terr.get(o.territory_id) ?? String(o.territory_id),
        category: o.category_id ? categorySlug : null,
        periodStart: o.period_start,
        periodEnd: o.period_end,
        value: Number(o.value),
        unit: o.unit,
        grade: o.grade,
        flag: o.status_flag,
        source: src,
        sourceRef: o.source_ref,
        runId: o.run_id,
        runFinishedAt: (o.source_runs as unknown as { finished_at: string | null } | null)?.finished_at ?? null,
        methodVersion: o.method_version_id,
        isDemo: o.is_demo,
      });
    }
  }
  return out.sort((a, b) => a.indicator.localeCompare(b.indicator) || a.seriesKey.localeCompare(b.seriesKey) || a.periodStart.localeCompare(b.periodStart));
}


type Db = Awaited<ReturnType<typeof requireUser>>["supabase"];

async function loadCsiProvenance(
  supabase: Db,
  csi: { category_id: number; territory_id: number; period_start: string; period_end: string; source_ids: number[] },
): Promise<NonNullable<CellSheet["consumers"]>["provenance"]> {
  const sources = await Promise.all(
    csi.source_ids.map(async (sourceId) => {
      const [src, count, run] = await Promise.all([
        supabase.from("sources").select("slug, name, url, licence").eq("id", sourceId).single(),
        supabase
          .from("mentions")
          .select("id, mention_scores!inner(relevant)", { count: "exact", head: true })
          .eq("source_id", sourceId)
          .eq("category_id", csi.category_id)
          .eq("territory_id", csi.territory_id)
          .eq("mention_scores.relevant", true)
          .gte("published_on", csi.period_start)
          .lte("published_on", csi.period_end),
        supabase
          .from("source_runs")
          .select("id, finished_at")
          .eq("source_id", sourceId)
          .in("status", ["succeeded", "partial"])
          .order("finished_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      return {
        slug: src.data?.slug ?? String(sourceId),
        name: src.data?.name ?? String(sourceId),
        url: src.data?.url ?? "",
        licence: src.data?.licence ?? null,
        mentions: count.count ?? 0,
        lastRun: run.data ? { id: run.data.id, finishedAt: run.data.finished_at } : null,
      };
    }),
  );
  const { data: scored } = await supabase
    .from("mentions")
    .select("mention_scores!inner(model, prompt_version)")
    .eq("category_id", csi.category_id)
    .eq("territory_id", csi.territory_id)
    .limit(1)
    .maybeSingle();
  const ms = (scored?.mention_scores as unknown as { model: string; prompt_version: string } | null) ?? null;
  return { sources, scoring: ms ? { model: ms.model, promptVersion: ms.prompt_version } : null };
}

async function loadLeversBarriers(supabase: Db, csiId: number, base: Omit<Figure, "value" | "unit">) {
  const [l, b] = await Promise.all([
    supabase.from("levers").select("label_it, label_en, share, mention_count, example_mention_ids").eq("csi_snapshot_id", csiId).order("mention_count", { ascending: false }),
    supabase.from("barriers").select("label_it, label_en, share, mention_count, example_mention_ids").eq("csi_snapshot_id", csiId).order("mention_count", { ascending: false }),
  ]);
  const exampleIds = [...(l.data ?? []), ...(b.data ?? [])].flatMap((x) => x.example_mention_ids.slice(0, 2));
  const { data: ex } = exampleIds.length ? await supabase.from("mentions").select("id, excerpt").in("id", exampleIds) : { data: [] };
  const text = new Map((ex ?? []).map((m) => [m.id, m.excerpt]));
  const map = (rows: typeof l.data) =>
    (rows ?? []).map((r) => ({
      label_it: r.label_it,
      label_en: r.label_en,
      share: { ...base, value: r.share == null ? null : Number(r.share), unit: "share" } as Figure,
      mentionCount: r.mention_count,
      examples: r.example_mention_ids.slice(0, 2).map((id) => text.get(id)).filter((x): x is string => Boolean(x)),
    }));
  return { levers: map(l.data), barriers: map(b.data) };
}
