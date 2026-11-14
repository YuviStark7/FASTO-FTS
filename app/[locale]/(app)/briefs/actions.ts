"use server";
import { getExportable, recordExport } from "@/lib/queries/briefs";

/** Writes the `exports` row for a PDF (print) export. The same gate as the print page applies. */
export async function recordPdfExport(briefId: number, versionId: number): Promise<{ ok: boolean }> {
  if (!Number.isInteger(briefId) || !Number.isInteger(versionId)) return { ok: false };
  const x = await getExportable(briefId, versionId);
  // The staff-only `v` parameter is ignored for other readers: never record a version they were not shown.
  if (!x.ok || x.version.id !== versionId) return { ok: false };
  return { ok: await recordExport(x, "pdf") };
}
