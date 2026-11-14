import { getTranslations } from "next-intl/server";
import { briefToDocx } from "@/lib/export/brief-docx";
import { buildBriefDocMeta } from "@/lib/export/brief-meta";
import { getExportable, recordExport, type ExportRefusal } from "@/lib/queries/briefs";

export const dynamic = "force-dynamic";

const STATUS: Record<ExportRefusal, number> = { not_found: 404, viewer: 403, check_failed: 409, unreadable: 422 };

/** Word export of one brief version: the same gate, content and sources table as the print page. */
export async function GET(request: Request, { params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale: raw, id } = await params;
  const locale = raw === "en" ? "en" : "it";
  const v = new URL(request.url).searchParams.get("v");
  const t = await getTranslations({ locale, namespace: "briefs.export.refused" });
  const refuse = (reason: ExportRefusal) => new Response(t(reason), { status: STATUS[reason], headers: { "content-type": "text/plain; charset=utf-8" } });

  if (!/^\d+$/.test(id) || (v != null && !/^\d+$/.test(v))) return refuse("not_found");
  const x = await getExportable(Number(id), v != null ? Number(v) : null);
  if (!x.ok) return refuse(x.reason);

  const meta = await buildBriefDocMeta(x, locale);
  const file = await briefToDocx(x.content, meta);
  // The export is logged before the file leaves: an export we cannot record is not handed out.
  if (!(await recordExport(x, "docx"))) return refuse("viewer");

  const filename = `brief-${x.detail.category.slug}-${x.detail.territory.slug}-v${x.version.version}.docx`;
  return new Response(new Uint8Array(file), {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "content-disposition": `attachment; filename="${filename}"`,
      "cache-control": "private, no-store",
    },
  });
}
