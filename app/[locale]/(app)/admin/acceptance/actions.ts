"use server";
import { getStaffRole } from "@/lib/admin";
import { validateManual, type AcceptanceRow, type ManualField } from "@/lib/acceptance";

export type SaveManualResult = { ok: true } | { ok: false; errors?: Partial<Record<ManualField, true>> };

/**
 * Records a hand-kept acceptance value (firms, trained users) with the signed-in user's own client:
 * RLS and the column grant decide, the role check is defence in depth, the audit trigger records it.
 * Measured targets are refused: their value comes from the data. No revalidation: the editor reloads.
 */
export async function saveManualValue(slug: string, input: { value?: string; note?: string }): Promise<SaveManualResult> {
  const { supabase, role } = await getStaffRole();
  if (role !== "admin" || typeof slug !== "string") return { ok: false };
  const parsed = validateManual(input ?? {});
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const { data: rows, error } = await supabase.rpc("acceptance_progress");
  if (error) return { ok: false };
  const target = (rows as AcceptanceRow[] | null)?.find((r) => r.slug === slug);
  if (!target || target.measured) return { ok: false };

  const { data, error: e } = await supabase.from("acceptance_targets").update({ manual_value: parsed.value, manual_note: parsed.note }).eq("slug", slug).select("slug");
  if (e || data?.length !== 1) return { ok: false };
  return { ok: true };
}
