import "server-only";
import { getTranslations } from "next-intl/server";
import { formatDate } from "@/components/sheet/format";
import type { Exportable } from "@/lib/queries/briefs";
import type { BriefDocMeta } from "./brief-docx";

const CELL_STATUSES = ["expanding", "consolidated", "threatened", "insufficient_data"] as const;
const INPUTS = ["trend", "geo", "csi", "competition"] as const;
const isOneOf = <T extends string>(list: readonly T[], x: string): x is T => (list as readonly string[]).includes(x);

/** Translated labels and header values shared by the print page and the Word export. */
export async function buildBriefDocMeta(x: Extract<Exportable, { ok: true }>, locale: "it" | "en"): Promise<BriefDocMeta> {
  const [t, ts, ti, tg, tc, ta] = await Promise.all([
    getTranslations({ locale, namespace: "briefs" }),
    getTranslations({ locale, namespace: "status" }),
    getTranslations({ locale, namespace: "inputs" }),
    getTranslations({ locale, namespace: "grade" }),
    getTranslations({ locale, namespace: "common" }),
    getTranslations({ locale, namespace: "advisor" }),
  ]);
  const { detail, version, content } = x;
  const ctx = content.context;
  const name = (n: { name_it: string; name_en: string }) => (locale === "en" ? n.name_en : n.name_it);
  const isCurrent = version.id === detail.currentVersionId;

  return {
    title: t("export.docTitle", { category: name(detail.category), territory: name(detail.territory) }),
    header: [
      { label: t("export.category"), value: name(detail.category) },
      { label: t("export.city"), value: ctx.country ? `${name(detail.territory)} (${ctx.country})` : name(detail.territory) },
      { label: t("export.version"), value: String(version.version) },
      // The review status belongs to the brief's current version; any other version is a history copy.
      { label: t("export.status"), value: isCurrent ? t(`status.${detail.status}`) : t("export.historyVersion") },
      { label: t("export.generated"), value: formatDate(version.createdAt, locale) },
      { label: t("export.language"), value: version.locale.toUpperCase() },
      { label: t("export.model"), value: version.model },
      { label: t("export.promptVersion"), value: version.promptVersion },
    ],
    contextTitle: t("context.title"),
    context: [
      { label: t("context.cellStatus"), value: [isOneOf(CELL_STATUSES, ctx.status) ? ts(ctx.status) : ctx.status, ctx.statusRule].filter(Boolean).join(". ") },
      { label: t("context.missingInputs"), value: ctx.missingInputs.length ? ctx.missingInputs.map((m) => (isOneOf(INPUTS, m) ? ti(m) : m)).join(", ") : t("context.noneMissing") },
      ...(ctx.representativenessNote ? [{ label: t("context.representativeness"), value: ctx.representativenessNote }] : []),
    ],
    demoLabel: ctx.isDemo ? tc("demo") : null,
    sourcesTitle: ta("factsTitle"),
    columns: {
      id: t("export.columns.id"),
      label: t("export.columns.label"),
      value: t("export.columns.value"),
      grade: t("export.columns.grade"),
      period: ta("period"),
      method: ta("method"),
      source: ta("source"),
      reference: t("export.columns.reference"),
    },
    gradeNames: { A: tg("A"), B: tg("B"), C: tg("C") },
    noGrade: ta("noGrade"),
    footer: t("export.footer"),
  };
}
