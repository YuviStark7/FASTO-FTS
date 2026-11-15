"use server";
import { getStaffRole } from "@/lib/admin";
import { CAP_FIELDS, ROLES, validateCaps, type AppRole, type CapError, type CapField } from "@/lib/admin-ops";

/*
 * Every write here goes through the signed-in user's own client: RLS and the column grants decide,
 * the role check is defence in depth. The audit triggers record who changed what. None of these
 * revalidate: the calling component reloads the document after a successful change.
 */

/** Kill switch: `ai.enabled` in `app_config`. */
export async function setAiEnabled(enabled: boolean): Promise<{ ok: boolean }> {
  const { supabase, role } = await getStaffRole();
  if (role !== "admin" || typeof enabled !== "boolean") return { ok: false };
  const { data, error } = await supabase.from("app_config").update({ value: enabled }).eq("key", "ai.enabled").select("key");
  return { ok: !error && (data?.length ?? 0) === 1 };
}

export type SaveCapsResult = { ok: true; changed: number } | { ok: false; errors?: Partial<Record<CapField, CapError>> };

/** Caps editor. Ranges are validated here, whatever the browser sent. Only changed keys are written, so the audit log stays quiet. */
export async function saveCaps(input: Partial<Record<CapField, string>>): Promise<SaveCapsResult> {
  const { supabase, role } = await getStaffRole();
  if (role !== "admin") return { ok: false };
  const parsed = validateCaps(input ?? {});
  if (!parsed.ok) return { ok: false, errors: parsed.errors };

  const { data: current, error } = await supabase
    .from("app_config")
    .select("key, value")
    .in(
      "key",
      CAP_FIELDS.map((c) => c.key),
    );
  if (error) return { ok: false };
  let changed = 0;
  for (const { field, key } of CAP_FIELDS) {
    const next = parsed.values[field];
    if (current?.find((c) => c.key === key)?.value === next) continue;
    const { data, error: e } = await supabase.from("app_config").update({ value: next }).eq("key", key).select("key");
    if (e || data?.length !== 1) return { ok: false };
    changed += 1;
  }
  return { ok: true, changed };
}

export type SetRoleResult = { ok: true } | { ok: false; reason: "notAllowed" | "self" | "database"; message?: string };

/** Role change on one membership. The database refuses demoting the last admin; its message is passed back. */
export async function setUserRole(userId: string, orgId: string, next: AppRole): Promise<SetRoleResult> {
  const { supabase, role, userId: me } = await getStaffRole();
  if (role !== "admin" || !(ROLES as readonly string[]).includes(next)) return { ok: false, reason: "notAllowed" };
  if (userId === me) return { ok: false, reason: "self" };
  const { data, error } = await supabase.from("memberships").update({ role: next }).eq("user_id", userId).eq("org_id", orgId).select("user_id");
  if (error) return { ok: false, reason: "database", message: error.message };
  if (!data?.length) return { ok: false, reason: "notAllowed" };
  return { ok: true };
}
