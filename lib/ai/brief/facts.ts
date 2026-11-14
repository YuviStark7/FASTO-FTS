import "server-only";
import { requireUser } from "@/lib/auth";
import { getCellSheet, type Figure } from "@/lib/queries/cell";
import { formatValue } from "@/components/sheet/format";
import type { Fact, FactPack, SectionKey } from "./types";

/**
 * Builds the brief's fact pack from what the cell sheet already shows: the same figures, the same
 * grades, formatted by code. Missing or unpublished figures are left out, never sent as zero.
 */
export async function buildFactPack(categorySlug: string, territorySlug: string, locale: "it" | "en"): Promise<FactPack | null> {
  const sheet = await getCellSheet(categorySlug, territorySlug, locale);
  if (!sheet) return null;
  const { supabase } = await requireUser();
  const { data: cell } = await supabase
    .from("cells")
    .select("trend_snapshot_id, geo_estimate_id, csi_snapshot_id, mos_snapshot_id")
    .eq("category_id", sheet.category.id)
    .eq("territory_id", sheet.territory.id)
    .single();
  const { data: mos } = cell?.mos_snapshot_id
    ? await supabase.from("mos_snapshots").select("id, mos, grade, coverage_pct, is_partial, rank, components, computed_at").eq("id", cell.mos_snapshot_id).single()
    : { data: null };

  const it = locale === "it";
  const name = (x: { name_it: string; name_en: string }) => (it ? x.name_it : x.name_en);
  const facts: Fact[] = [];
  const add = (section: SectionKey, label: string, display: string, f: Pick<Figure, "grade" | "period" | "methodVersion" | "observationIds">, source: string, snapshotRef: string | null) => {
    facts.push({
      id: `F${facts.length + 1}`,
      section,
      label,
      display,
      grade: f.grade,
      period: f.period,
      method: f.methodVersion,
      source,
      observationIds: [...new Set(f.observationIds)],
      snapshotRef,
    });
  };
  const fig = (section: SectionKey, label: string, f: Figure | null | undefined, source: string, ref: string | null) => {
    if (!f || f.value == null || !f.grade) return;
    add(section, label, formatValue(f.value, f.unit, locale), f, source, ref);
  };

  const trendRef = cell?.trend_snapshot_id ? `trend_snapshots:${cell.trend_snapshot_id}` : null;
  const geoRef = cell?.geo_estimate_id ? `geo_estimates:${cell.geo_estimate_id}` : null;
  const csiRef = cell?.csi_snapshot_id ? `csi_snapshots:${cell.csi_snapshot_id}` : null;

  // Market (national)
  const m = sheet.market;
  if (m && m.status !== "insufficient_data") {
    const eurostat = "Eurostat";
    fig("market", it ? "Crescita annua del valore reale (CAGR)" : "Real value growth per year (CAGR)", m.realValueCagr, eurostat, trendRef);
    fig("market", it ? "Crescita annua del valore nominale (CAGR)" : "Nominal value growth per year (CAGR)", m.nominalValueCagr, eurostat, trendRef);
    fig("market", it ? "Crescita annua dei volumi (CAGR)" : "Volume growth per year (CAGR)", m.volumeCagr, eurostat, trendRef);
    fig("market", it ? "Spesa nazionale delle famiglie, ultimo anno" : "National household spend, latest year", m.latestNominal, eurostat, trendRef);
  }

  // Territory (city, model estimate)
  const t = sheet.territoryTab;
  if (t) {
    const ld = t.localDemand;
    if (ld.value != null && ld.grade) {
      const range = ld.low != null && ld.high != null ? ` (${formatValue(ld.low, ld.unit, locale)} – ${formatValue(ld.high, ld.unit, locale)})` : "";
      add("territory", it ? "Domanda locale stimata (intervallo)" : "Estimated local demand (interval)", `${formatValue(ld.value, ld.unit, locale)}${range}`, ld, it ? "Stima del modello geo-v1" : "geo-v1 model estimate", geoRef);
    }
    fig("territory", it ? "Spesa pro capite stimata" : "Estimated spend per head", t.perCapita, it ? "Stima del modello geo-v1" : "geo-v1 model estimate", geoRef);
    fig("territory", it ? "Popolazione residente" : "Resident population", t.population, "Eurostat / ISTAT", geoRef);
    fig("territory", it ? "Presenze turistiche (notti)" : "Tourist nights", t.touristNights, "Eurostat / ISTAT", geoRef);
  }

  // Consumers (online, exploratory)
  const c = sheet.consumers;
  if (c?.published) {
    const src = c.provenance.sources.map((s) => s.name).join(", ") || "Bluesky";
    fig("consumers", it ? "Indice di sentiment dei consumatori (CSI, 0–100)" : "Consumer Sentiment Index (CSI, 0–100)", c.csi, src, csiRef);
    fig("consumers", it ? "Menzioni analizzate" : "Mentions analysed", c.nMentions, src, csiRef);
    for (const l of c.levers.slice(0, 3)) fig("consumers", `${it ? "Leva" : "Lever"}: ${it ? l.label_it : l.label_en} (${it ? "quota delle menzioni" : "share of mentions"})`, l.share, src, csiRef);
    for (const b of c.barriers.slice(0, 3)) fig("consumers", `${it ? "Barriera" : "Barrier"}: ${it ? b.label_it : b.label_en} (${it ? "quota delle menzioni" : "share of mentions"})`, b.share, src, csiRef);
  }

  // Competition (Open Food Facts coverage, not market share)
  for (const a of sheet.competition.assortment.slice(0, 4)) {
    fig("competition", `${it ? "Prodotti osservati con etichetta" : "Products observed with label"} "${a.tag}" (${it ? "copertura Open Food Facts" : "Open Food Facts coverage"})`, a.figure, "Open Food Facts", null);
  }

  // Opportunity
  if (mos?.mos != null && mos.grade) {
    const base = { grade: mos.grade, period: mos.computed_at.slice(0, 10), methodVersion: "mos-v1", observationIds: [] as number[] };
    const ref = `mos_snapshots:${mos.id}`;
    add("entry", it ? "Market Opportunity Score (0–100)" : "Market Opportunity Score (0–100)", formatValue(Number(mos.mos), "index_0_100", locale), base, "mos-v1", ref);
    add("entry", it ? "Copertura dei componenti del MOS" : "MOS component coverage", formatValue(Number(mos.coverage_pct) / 100, "share", locale), base, "mos-v1", ref);
    if (mos.rank != null) add("entry", it ? "Posizione nella classifica MOS (su 300 celle)" : "Rank by MOS (of 300 cells)", String(mos.rank), base, "mos-v1", ref);
  }

  return {
    locale,
    category: name(sheet.category),
    territory: name(sheet.territory),
    country: name(sheet.territory.country),
    status: sheet.cell.status,
    statusRule: sheet.market?.reason ?? null,
    missingInputs: sheet.cell.missingInputs,
    representativenessNote: c?.published ? c.representativenessNote : null,
    isDemo: sheet.cell.isDemo,
    facts,
  };
}
