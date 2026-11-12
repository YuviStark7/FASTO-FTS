"use server";
import { getCellSheet, type Figure } from "@/lib/queries/cell";

export type ScoutFrameKey =
  | "realValueCagr"
  | "volumeCagr"
  | "latestNominal"
  | "localDemand"
  | "csi"
  | "pageviews"
  | "mediaAttention"
  | "perCapita";

export type ScoutFigure = { key: ScoutFrameKey; figure: Figure };

/** A figure that does not exist: no value and no grade, rendered as the hatched insufficient state. */
const missing = (unit: string): Figure => ({ value: null, unit, grade: null, period: "", methodVersion: "", observationIds: [] });

/**
 * Key figures of one cell for the Scout frames. Nothing is computed here: every entry is a Figure
 * already built (and graded) by getCellSheet, with its observation ids kept.
 */
export async function getScoutFigures(category: string, territory: string, locale: string): Promise<ScoutFigure[]> {
  if (typeof category !== "string" || typeof territory !== "string" || category.length > 80 || territory.length > 80) return [];
  const sheet = await getCellSheet(category, territory, locale === "en" ? "en" : "it");
  if (!sheet) return [];
  const attention = (ind: "pageviews" | "media_attention") => sheet.attention.find((a) => a.indicator === ind)?.figure;
  const out: ScoutFigure[] = [
    { key: "realValueCagr", figure: sheet.market?.realValueCagr ?? missing("ratio_per_year") },
    { key: "volumeCagr", figure: sheet.market?.volumeCagr ?? missing("ratio_per_year") },
    { key: "latestNominal", figure: sheet.market?.latestNominal ?? missing("EUR") },
    { key: "localDemand", figure: sheet.territoryTab?.localDemand ?? missing("EUR") },
  ];
  // Sentiment only when published; an unpublished reading is not shown at all.
  if (sheet.consumers?.published) out.push({ key: "csi", figure: sheet.consumers.csi });
  out.push(
    { key: "pageviews", figure: attention("pageviews") ?? missing("count") },
    { key: "mediaAttention", figure: attention("media_attention") ?? missing("count") },
    { key: "perCapita", figure: sheet.territoryTab?.perCapita ?? missing("EUR_per_capita") },
  );
  return out;
}
